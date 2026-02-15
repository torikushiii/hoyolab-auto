# Cache Directory

This directory contains the application's cache file and related data.

## Cache File
The script will auto-generate a `cache.json` file in this directory once it has been run for the first time.

### What is cached?
- Game account data (stamina, expeditions, etc.)
- API response data to reduce server load
- Temporary data to improve application performance

### Cache File Location
- **Standard Installation**: `./data/cache.json`
- **Docker Installation**: `/app/data/cache.json` (inside container)

### Important Notes
- **Do not manually edit** the cache file - it's managed automatically
- The cache file will be **recreated if deleted**
- Cache data expires automatically based on configured intervals
- You can safely delete the cache file to reset all cached data
- Ensure this directory has **write permissions** for the application

### Troubleshooting
If you encounter cache-related issues:
1. Stop the application
2. Delete the `cache.json` file
3. Restart the application

The cache will be rebuilt automatically with fresh data from the APIs.