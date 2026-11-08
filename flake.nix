{
  description = "Tool Atlas — Reproducible static web application, OCI container, and NixOS deployment module";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      pkgsFor = system: import nixpkgs { inherit system; };
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
          staticSite = pkgs.callPackage ./deploy/nix/package.nix {
            inherit self;
          };
          ociContainer = pkgs.callPackage ./deploy/nix/container.nix {
            inherit self staticSite;
          };
        in
        {
          default = staticSite;
          static-site = staticSite;
          container = ociContainer;
        }
      );

      nixosModules = {
        default = import ./deploy/nix/nixos-module.nix { inherit self; };
        tool-atlas = import ./deploy/nix/nixos-module.nix { inherit self; };
      };

      devShells = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          default = pkgs.mkShell {
            name = "tool-atlas-dev";
            packages = [
              pkgs.nodejs_24
              pkgs.pnpm_10
              pkgs.git
              pkgs.jq
              pkgs.caddy
              pkgs.nginx
            ];
            shellHook = ''
              export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
              echo "Tool Atlas Nix development shell ready (Node $(node --version), pnpm $(pnpm --version))"
            '';
          };
        }
      );

      checks = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          static-site = self.packages.${system}.static-site;
        }
      );
    };
}
