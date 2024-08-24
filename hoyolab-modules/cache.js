module.exports = class DataCache {
	static keyvCacheExpiration = 3_600_000;

	static data = new Map();
	static expirationInterval;

	constructor (expiration, rate) {
		this.expiration = expiration;
		this.rate = rate;

		if (!DataCache.expirationInterval) {
			DataCache.expirationInterval = setInterval(() => this.clearExpiredData(), this.expiration);
		}
	}

	clearExpiredData () {
		const now = Date.now();
		let clearedCount = 0;
		for (const [key, value] of DataCache.data.entries()) {
			if (now - value.lastUpdate > DataCache.keyvCacheExpiration) {
				DataCache.data.delete(key);
				clearedCount++;
			}
		}
		app.Logger.debug("Cache", `Cleared ${clearedCount} expired items from cache`);
	}

	async set (key, value, lastUpdate = Date.now()) {
		const data = { ...value, lastUpdate };
		DataCache.data.set(key, data);

		if (app.Cache) {
			await app.Cache.set({
				key,
				value: data,
				expiry: DataCache.keyvCacheExpiration
			});
		}
	}

	async get (key) {
		try {
			// 1. Attempt to get data from memory cache
			let cachedData = DataCache.data.get(key);
			if (cachedData) {
				app.Logger.debug("Cache", `Cache hit for key: ${key} (memory)`);

				return await this.#updateCachedData(cachedData);
			}

			// 2. Attempt to get data from keyv cache
			if (app.Cache) {
				cachedData = await app.Cache.get(key);
				if (cachedData) {
					app.Logger.debug("Cache", `Cache hit for key: ${key} (keyv)`);

					const updatedData = await this.#updateCachedData(cachedData);
					DataCache.data.set(key, updatedData);

					return updatedData;
				}
			}

			app.Logger.debug("Cache", `Cache miss for key: ${key}`);
			return null;
		}
		catch (e) {
			app.Logger.error("Cache", `Error getting cache for key ${key}: ${e.message}`);
			return null;
		}
	}

	async #updateCachedData (cachedData) {
		const now = Date.now();
		const secondsSinceLastUpdate = (now - cachedData.lastUpdate) / 1000;

		if (now - cachedData.lastUpdate > DataCache.keyvCacheExpiration) {
			await DataCache.invalidateCache(cachedData.uid);
			return null;
		}

		if (cachedData.stamina) {
			const account = app.HoyoLab.getAccountById(cachedData.uid);

			const staminaGained = (secondsSinceLastUpdate / this.rate);

			cachedData.stamina.fractionalStamina = (cachedData.stamina.fractionalStamina || 0) + staminaGained;

			const staminaToAdd = Math.floor(cachedData.stamina.fractionalStamina);
			cachedData.stamina.currentStamina = Math.min(
				cachedData.stamina.maxStamina,
				cachedData.stamina.currentStamina + staminaToAdd
			);

			cachedData.stamina.fractionalStamina -= staminaToAdd;
			cachedData.stamina.recoveryTime = Math.max(0, cachedData.stamina.recoveryTime - Math.round(secondsSinceLastUpdate));

			const isMaxStamina = (cachedData.stamina.currentStamina === cachedData.stamina.maxStamina);
			const isAboveThreshold = (cachedData.stamina.currentStamina > account.stamina.threshold);
			const staminaAlmostFull = (cachedData.stamina.maxStamina - cachedData.stamina.currentStamina) <= 10 && isAboveThreshold;

			if (isMaxStamina || isAboveThreshold || staminaAlmostFull) {
				await DataCache.invalidateCache(cachedData.uid);
				return null;
			}
		}

		if (this.#shouldInvalidateExpedition(cachedData, secondsSinceLastUpdate)
            || this.#shouldInvalidateShop(cachedData)
            || this.#shouldInvalidateRealm(cachedData, secondsSinceLastUpdate)) {
			await DataCache.invalidateCache(cachedData.uid);
			return null;
		}

		const expiration = Math.max(0, DataCache.keyvCacheExpiration - (now - cachedData.lastUpdate));
		await app.Cache.set({ key: cachedData.uid, value: cachedData, expiry: expiration });

		cachedData.lastUpdate = now;
		return cachedData;
	}

	#shouldInvalidateExpedition (cachedData, secondsSinceLastUpdate) {
		if (!cachedData.expedition || cachedData.expedition.list.length === 0) {
			return false;
		}

		for (const expedition of cachedData.expedition.list) {
			expedition.remaining_time = Math.max(0, Number(expedition.remaining_time) - Math.round(secondsSinceLastUpdate));
			if (expedition.remaining_time <= 0) {
				return true;
			}
		}

		return false;
	}

	#shouldInvalidateShop (cachedData) {
		return cachedData.shop && cachedData.shop.state === "Finished";
	}

	#shouldInvalidateRealm (cachedData, secondsSinceLastUpdate) {
		if (!cachedData.realm) {
			return false;
		}

		const realm = cachedData.realm;
		if (realm.currentCoin === realm.maxCoin) {
			return true;
		}

		realm.recoveryTime = Math.max(0, realm.recoveryTime - Math.round(secondsSinceLastUpdate));
		return realm.recoveryTime <= 0;
	}

	static async invalidateCache (key) {
		DataCache.data.delete(key);

		try {
			if (app.Cache) {
				await app.Cache.delete(key);
			}
			app.Logger.debug("Cache", `Invalidated cache for key: ${key}`);
		}
		catch (e) {
			app.Logger.error("Cache", `Error invalidating cache for key ${key}: ${e.message}`);
		}
	}

	static destroy () {
		clearInterval(DataCache.expirationInterval);
		DataCache.data.clear();
	}
};
