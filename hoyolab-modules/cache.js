module.exports = class DataCache {
	static keyvCacheExpiration = 3_600_000;

	constructor (rate) {
		this.rate = rate;
	}

	async set (key, value) {
		if (app.Cache) {
			await app.Cache.set({
				key,
				value,
				expiry: DataCache.keyvCacheExpiration
			});
		}
	}

	async get (key) {
		try {
			if (app.Cache) {
				const cachedData = await app.Cache.get(key);
				if (cachedData) {
					app.Logger.debug("Cache", `Cache hit for key: ${key} (keyv)`);

					const updatedData = await this.#updateCachedData(cachedData);
					return updatedData;
				}
			}

			app.Logger.debug("Cache", `Cache miss for key: ${key}`);
			return null;
		}
		catch (e) {
			console.error({
				message: "An error while getting the key",
				e
			});
			return null;
		}
	}

	async #updateCachedData (cachedData) {
		const now = Date.now();

		let secondsSinceLastUpdate;
		if (cachedData.lastUpdate === undefined) {
			secondsSinceLastUpdate = 0;
			cachedData.lastUpdate = now;
		}
		else {
			secondsSinceLastUpdate = Math.floor((now - cachedData.lastUpdate) / 1000) + 1;
		}

		if (cachedData.stamina) {
			const account = app.HoyoLab.getAccountById(cachedData.uid);

			cachedData.stamina.currentStamina = Number(cachedData.stamina.currentStamina) || 0;
			cachedData.stamina.recoveryTime = Number(cachedData.stamina.recoveryTime) || 0;

			const staminaToAdd = (secondsSinceLastUpdate / this.rate);
			cachedData.stamina.currentStamina = Math.min(
				cachedData.stamina.maxStamina,
				cachedData.stamina.currentStamina + staminaToAdd
			);

			cachedData.stamina.recoveryTime = Math.max(0, cachedData.stamina.recoveryTime - secondsSinceLastUpdate);
			cachedData.stamina.currentStamina = Math.round(cachedData.stamina.currentStamina * 100) / 100;

			if (cachedData.stamina.currentStamina >= cachedData.stamina.maxStamina) {
				cachedData.stamina.currentStamina = cachedData.stamina.maxStamina;
				cachedData.stamina.recoveryTime = 0;
			}

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

		cachedData.lastUpdate = now;
		const expiration = Math.max(0, DataCache.keyvCacheExpiration - (now - cachedData.expires));
		await app.Cache.set({ key: cachedData.uid, value: cachedData, expiry: expiration });

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
