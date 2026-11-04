{ self }:
{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.services.tool-atlas;
  defaultPackage = self.packages.${pkgs.stdenv.hostPlatform.system}.static-site;
  securityHeaders = ''
    add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: https:; manifest-src 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self'" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;
    add_header Permissions-Policy "accelerometer=(), autoplay=(), camera=(), clipboard-read=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), identity-credentials-get=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), web-share=(), xr-spatial-tracking=()" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
  '';
in
{
  options.services.tool-atlas = {
    enable = lib.mkEnableOption "Tool Atlas static web application origin";

    package = lib.mkOption {
      type = lib.types.package;
      default = defaultPackage;
      description = "Compiled static bundle package (`share/tool-atlas`) served by NGINX.";
    };

    domain = lib.mkOption {
      type = lib.types.str;
      default = "localhost";
      example = "atlas.example.com";
      description = "Virtual host domain name for NGINX and optional Caddy TLS edge proxy.";
    };

    listenPort = lib.mkOption {
      type = lib.types.port;
      default = 8080;
      description = "Internal HTTP port for the NGINX static origin.";
    };

    packagesDir = lib.mkOption {
      type = lib.types.path;
      default = "/srv/tool-atlas-packages";
      description = "Read-only directory containing verified first-party download artifacts.";
    };

    guideLibraryDir = lib.mkOption {
      type = lib.types.path;
      default = "/srv/tool-atlas-guides";
      description = "Read-only directory containing approved PDF/PPTX guide files.";
    };

    enableCaddyEdge = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Configure Caddy as an automated HTTPS reverse proxy in front of the NGINX origin.";
    };

    studio = {
      enable = lib.mkEnableOption "Local-only Tool Atlas Developer Studio (never expose publicly)";

      listenAddress = lib.mkOption {
        type = lib.types.str;
        default = "127.0.0.1";
        description = "Loopback bind address for the Developer Studio service.";
      };

      port = lib.mkOption {
        type = lib.types.port;
        default = 4174;
        description = "Loopback TCP port for the Developer Studio service.";
      };

      workingDirectory = lib.mkOption {
        type = lib.types.path;
        default = "/var/lib/tool-atlas-studio";
        description = "Mutable checkout path used by the local Developer Studio service.";
      };
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [
      {
        assertion = (!cfg.studio.enable) || (cfg.studio.listenAddress == "127.0.0.1" || cfg.studio.listenAddress == "::1");
        message = "services.tool-atlas.studio.listenAddress must remain bound to loopback (127.0.0.1 or ::1). Never expose Developer Studio publicly.";
      }
    ];

    services.nginx = {
      enable = true;
      recommendedGzipSettings = true;
      recommendedOptimisation = true;

      virtualHosts.${cfg.domain} = {
        listen = [
          {
            addr = if cfg.enableCaddyEdge then "127.0.0.1" else "0.0.0.0";
            port = cfg.listenPort;
          }
        ];
        root = "${cfg.package}/share/tool-atlas";

        locations = {
          "= /api/health" = {
            extraConfig = ''
              access_log off;
              default_type application/json;
              add_header Cache-Control "no-store" always;
              ${securityHeaders}
              return 200 '{"status":"ok"}\n';
            '';
          };

          "/assets/" = {
            extraConfig = ''
              expires 1y;
              add_header Cache-Control "public, max-age=31536000, immutable" always;
              ${securityHeaders}
              try_files $uri =404;
            '';
          };

          "/catalog/" = {
            extraConfig = ''
              expires 5m;
              add_header Cache-Control "public, max-age=300, stale-while-revalidate=60" always;
              ${securityHeaders}
              try_files $uri =404;
            '';
          };

          "/downloads/" = {
            alias = "${cfg.packagesDir}/";
            extraConfig = ''
              autoindex off;
              disable_symlinks on from=${cfg.packagesDir};
              limit_except GET HEAD {
                deny all;
              }
              default_type application/octet-stream;
              add_header Cache-Control "private, no-store" always;
              add_header Content-Disposition "attachment" always;
              ${securityHeaders}
              try_files $uri =404;
            '';
          };

          "/guides/" = {
            alias = "${cfg.guideLibraryDir}/";
            extraConfig = ''
              autoindex off;
              disable_symlinks on from=${cfg.guideLibraryDir};
              limit_except GET HEAD {
                deny all;
              }
              add_header Cache-Control "private, no-store" always;
              add_header Content-Disposition "inline" always;
              ${securityHeaders}
              try_files $uri =404;
            '';
          };

          "/" = {
            extraConfig = ''
              expires -1;
              add_header Cache-Control "no-cache" always;
              ${securityHeaders}
              try_files $uri $uri/ /index.html;
            '';
          };
        };
      };
    };

    services.caddy = lib.mkIf cfg.enableCaddyEdge {
      enable = true;
      virtualHosts.${cfg.domain}.extraConfig = ''
        encode zstd gzip
        header {
          Strict-Transport-Security "max-age=31536000; includeSubDomains"
          -Server
        }
        reverse_proxy 127.0.0.1:${toString cfg.listenPort}
      '';
    };

    systemd.services.tool-atlas-studio = lib.mkIf cfg.studio.enable {
      description = "Tool Atlas Local Developer Studio (Loopback Only)";
      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];
      environment = {
        NODE_ENV = "development";
        HOST = cfg.studio.listenAddress;
        PORT = toString cfg.studio.port;
      };
      serviceConfig = {
        Type = "simple";
        WorkingDirectory = cfg.studio.workingDirectory;
        ExecStart = "${pkgs.nodejs_24}/bin/node scripts/server.mjs";
        Restart = "on-failure";
        NoNewPrivileges = true;
        PrivateTmp = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        ReadWritePaths = [ cfg.studio.workingDirectory ];
      };
    };
  };
}
