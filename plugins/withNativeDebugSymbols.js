// Play Console'un "native debug symbols yuklenmemis" uyarisini cozer:
// prebuild sirasinda android/app/build.gradle'daki buildTypes.release blogu icine
// ndk.debugSymbolLevel 'SYMBOL_TABLE' ekler. Boylece semboller AAB'ye gomulur ve
// Play, native crash'leri okunur sekilde sembolize edebilir.
// Kullaniciya inen APK boyutunu etkilemez; sembol dosyasini Play sunucuda tutar.
const { withAppBuildGradle } = require('expo/config-plugins');

const NDK_BLOCK = `
            ndk {
                debugSymbolLevel 'SYMBOL_TABLE'
            }`;

module.exports = function withNativeDebugSymbols(config) {
  return withAppBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents;
    if (!contents.includes('debugSymbolLevel')) {
      // buildTypes blogu icindeki release blogunun hemen basina ekle.
      cfg.modResults.contents = contents.replace(
        /(buildTypes\s*\{[\s\S]*?release\s*\{)/,
        `$1${NDK_BLOCK}`
      );
    }
    return cfg;
  });
};
