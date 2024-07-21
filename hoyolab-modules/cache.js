module.exports = class DataCache {
	static data = new Map();
	static expirationInterval;

	constructor (expiration, rate) {
		this.expiration = expiration;
		this.rate = rate;

		if (!DataCache.expirationInterval) {
			DataCache.expirationInterval = setInterval(() => DataCache.data.clear(), this.expiration);
		}
	}

	async set (key, value, lastUpdate = Date.now()) {
		const data = { ...value, lastUpdate };
		DataCache.data.set(key, data);

		if (app.Cache) {
			await app.Cache.set({
				key,
				value: data,
				expiry: 3_600_000 // 1 hour
			});
		}
	}

	async get (key) {
		// 1. Attempt to get data from memory cache
		let cachedData = DataCache.data.get(key);
		if (cachedData) {
			return this.#updateCachedData(cachedData);
		}

		// 2. Attempt to get data from keyv cache
		if (app.Cache) {
			cachedData = await app.Cache.get(key);
			if (cachedData) {
				DataCache.data.set(key, cachedData);
				return this.#updateCachedData(cachedData);
			}
		}

		return null;
	}

	async #updateCachedData (cachedData) {
		const now = Date.now();

		if (now - cachedData.lastUpdate > this.expiration) {
			await DataCache.invalidateCache(cachedData.uid);
			return null;
		}

		const secondsSinceLastUpdate = (now - cachedData.lastUpdate) / 1000;
		const recoveredStamina = Math.floor(secondsSinceLastUpdate / this.rate);

		const account = app.HoyoLab.getAccountById(cachedData.uid);

		const isMaxStamina = cachedData.stamina.currentStamina === cachedData.stamina.maxStamina;
		const isAboveThreshold = cachedData.stamina.currentStamina > account.stamina.threshold;

		if (isMaxStamina || isAboveThreshold) {
			await DataCache.invalidateCache(cachedData.uid);
			return null;
		}

		cachedData.stamina.currentStamina = Math.min(
			cachedData.stamina.maxStamina,
			cachedData.stamina.currentStamina + recoveredStamina
		);
		cachedData.stamina.recoveryTime -= Math.round(secondsSinceLastUpdate);

		if (cachedData.stamina.recoveryTime <= 0) {
			await DataCache.invalidateCache(cachedData.uid);
			return null;
		}

		const expedition = cachedData.expedition;
		if (expedition && expedition.list.length !== 0) {
			for (const expedition of cachedData.expedition.list) {
				expedition.remaining_time = Number(expedition.remaining_time);
				if (expedition.remaining_time <= 0) {
					await DataCache.invalidateCache(cachedData.uid);
					return null;
				}
				else {
					expedition.remaining_time -= Math.round(secondsSinceLastUpdate);
				}
			}
		}

		if (cachedData.shop) {
			const shop = cachedData.shop;
			if (shop.state === "Finished") {
				await DataCache.invalidateCache(cachedData.uid);
				return null;
			}
		}

		if (cachedData.realm) {
			const realm = cachedData.realm;
			if (realm.currentCoin === realm.maxCoin) {
				await DataCache.invalidateCache(cachedData.uid);
				return null;
			}

			realm.recoveryTime -= Math.round(secondsSinceLastUpdate);
			if (realm.recoveryTime <= 0) {
				await DataCache.invalidateCache(cachedData.uid);
				return null;
			}
		}

		cachedData.lastUpdate = now;

		return cachedData;
	}

	static async invalidateCache (key) {
		DataCache.data.delete(key);

		if (app.Cache) {
			await app.Cache.delete(key);
		}
	}

	static destroy () {
		clearInterval(DataCache.expirationInterval);
		DataCache.data.clear();
	}
};
