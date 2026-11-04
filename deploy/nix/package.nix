{
  lib,
  stdenvNoCC,
  nodejs_24,
  pnpm_10,
  self,
}:

let
  packageJson = builtins.fromJSON (builtins.readFile ../../package.json);
in
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = packageJson.name;
  version = packageJson.version;

  src = lib.cleanSourceWith {
    src = ../..;
    filter =
      path: type:
      let
        relPath = lib.removePrefix (toString ../.. + "/") (toString path);
        excludedPrefixes = [
          ".git"
          ".github"
          ".gitlab"
          "dist"
          "node_modules"
          "packages"
          "test-results"
          "playwright-report"
          "result"
        ];
      in
      !(lib.any (prefix: relPath == prefix || lib.hasPrefix (prefix + "/") relPath) excludedPrefixes);
  };

  nativeBuildInputs = [
    nodejs_24
    pnpm_10.configHook
  ];

  pnpmDeps = pnpm_10.fetchDeps {
    inherit (finalAttrs) pname version src;
    fetcherVersion = 1;
    hash = lib.fakeHash;
  };

  buildPhase = ''
    runHook preBuild
    export CI=true
    node --input-type=module -e "import { assertSupportedNode } from './scripts/runtime-version.mjs'; assertSupportedNode()"
    pnpm build
    node scripts/verify-dist.mjs
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p "$out/share/tool-atlas"
    cp -r dist/. "$out/share/tool-atlas/"
    runHook postInstall
  '';

  meta = {
    description = "Tool Atlas static web application and verified software catalog bundle";
    homepage = "https://github.com/ShalevZ923/ShalevSoftwareSite";
    license = lib.licenses.asl20;
    platforms = lib.platforms.all;
  };
})
