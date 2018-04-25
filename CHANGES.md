## Changes

### 1.0.8
- Updated rcc-core dependency

### 1.0.7
- Added dummy implementations for missing `info` and `exec` functions to `redis-mock` client prototype
- Minor code cleanups

### 1.0.5
- Moved all fixing of RedisClient functions and adaptation of the RedisClient prototype to happen at module load time 
  in order to fix sequencing bugs where promise-returning "Async" functions installed later by `redis-client-cache` were 
  NOT seeing the fixed `ping` function

### 1.0.4
- Added workaround for `redis-mock` module's `ping` function ONLY accepting a callback function as the first argument -
  instead of also handling an optional ping response as a first argument
- Added unit tests to verify overridden `ping` function survives a ping response in its first argument

### 1.0.3
- Replaced `getDefaultHost` function with `defaultHost` property
- Replaced `getDefaultPort` function with `defaultPort` property

### 1.0.2
- Added `.npmignore`
- Renamed `release_notes.md` to `CHANGES.md`
- Updated dependencies

### 1.0.1
- Added better mocked support for `getOptions` and `resolveHostAndPort`

### 1.0.0
- Initial version