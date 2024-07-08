const Keyv = require("keyv");
const { KeyvFile } = require("keyv-file");

const GROUP_DELIMITER = String.fromCharCode(7);
const ITEM_DELIMITER = String.fromCharCode(8);

const isValidInteger = (value) => {
	if (typeof value !== "number") {
		return false;
	}

	return Boolean(Number.isFinite(value) && Math.trunc(value) === value);
};

module.exports = class Cache {
	#store;

	constructor () {
		this.#store = new Keyv({
			store: new KeyvFile({
				filename: "./data/cache.json",
				serialize: JSON.stringify,
				deserialize: JSON.parse
			})
		});
	}

	async set (data = {}) {
		if (typeof data.value === "undefined") {
			throw new app.Error({
				message: "Provided value must not be undefined"
			});
		}

		let key = Cache.resolveKey(data.key);
		if (typeof data.specificKey === "string") {
			key += `-${data.specificKey}`;
		}

		if (data.expiry) {
			if (!isValidInteger(data.expiry)) {
				throw new app.Error({
					message: "If provided, expiry must be a valid positive integer",
					args: { data }
				});
			}

			return await this.#store.set(key, data.value, data.expiry);
		}

		return await this.#store.set(key, data.value);
	}

	async get (keyIdentifier) {
		const key = Cache.resolveKey(keyIdentifier);
		return await this.#store.get(key);
	}

	async delete (keyIdentifier) {
		const key = Cache.resolveKey(keyIdentifier);
		return await this.#store.delete(key);
	}

	async getByPrefix (prefix, options = {}) {
		const extraKeys = options.keys ?? {};
		const key = Cache.resolvePrefix(prefix, extraKeys);

		return await this.get(key);
	}

	async getKeysByPrefix (prefix, options = {}) {
		const prefixKey = [prefix];
		const extraKeys = options.keys ?? {};

		for (const [key, value] of Object.entries(extraKeys)) {
			if (value === null || value === undefined) {
				prefixKey.push(key, ITEM_DELIMITER, "*");
			}
			else {
				prefixKey.push(key, ITEM_DELIMITER, String(value));
			}
		}

		const searchKey = prefixKey.join(GROUP_DELIMITER);

		// Keyv doesn't have a scan function, so this will retrieve all keys
		// and then filter based on the prefix.
		const allKeys = await this.#store.keys();
		const filteredKeys = allKeys.filter(key => key.startsWith(searchKey));
		return filteredKeys;
	}

	async getKeyValuesByPrefix (prefix, options) {
		const keys = await this.getKeysByPrefix(prefix, options);
		const promises = keys.map(async i => await this.get(i));

		return await Promise.all(promises);
	}

	/**
	 * Cleans up and destroys the singleton caching instance
	 */
	destroy () {
		this.#store = null;
	}

	static resolveKey (value) {
		if (value === null || typeof value === "undefined") {
			throw new app.Error({
				message: "Cannot use null or undefined as key"
			});
		}

		if (typeof value?.getCacheKey === "function") {
			return value.getCacheKey();
		}
		else if (typeof value !== "object") {
			return String(value);
		}
		else {
			throw new app.Error({
				message: "Cannot stringify a non-primitive value",
				args: {
					value
				}
			});
		}
	}

	static resolvePrefix (mainKey, keys) {
		keys = Object.entries(keys);
		if (keys.length === 0) {
			return mainKey;
		}

		const rest = [];
		for (const [key, rawValue] of keys) {
			const value = String(rawValue);
			if (key.includes(GROUP_DELIMITER) || key.includes(ITEM_DELIMITER)) {
				throw new app.Error({
					message: "Cache prefix keys cannot contain reserved characters",
					args: { key, value }
				});
			}
			else if (value.includes(GROUP_DELIMITER) || value.includes(ITEM_DELIMITER)) {
				throw new app.Error({
					message: "Cache prefix vaolues cannot contain reserved characters",
					args: { key, value }
				});
			}

			rest.push(`${key}${ITEM_DELIMITER}${value}`);
		}

		return [mainKey, ...rest.sort()].join(GROUP_DELIMITER);
	}
};
