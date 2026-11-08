{
  lib,
  dockerTools,
  buildEnv,
  nginx,
  cacert,
  tzdata,
  self,
  staticSite,
}:

let
  nginxConf = ../docker/nginx.conf;
  rootfs = buildEnv {
    name = "tool-atlas-container-root";
    paths = [
      nginx
      cacert
      tzdata
    ];
    pathsToLink = [
      "/bin"
      "/etc"
      "/share"
    ];
  };
in
dockerTools.buildLayeredImage {
  name = "tool-atlas";
  tag = staticSite.version;

  contents = [ rootfs ];

  extraCommands = ''
    mkdir -p usr/share/nginx/html srv/tool-atlas-packages srv/tool-atlas-guides etc/nginx var/log/nginx var/cache/nginx tmp
    chmod 1777 tmp
    cp -r ${staticSite}/share/tool-atlas/. usr/share/nginx/html/
    rm -f usr/share/nginx/html/_headers
    cp ${nginxConf} etc/nginx/nginx.conf
  '';

  config = {
    User = "101:101";
    ExposedPorts = {
      "8080/tcp" = { };
    };
    WorkingDir = "/usr/share/nginx/html";
    Cmd = [
      "${nginx}/bin/nginx"
      "-c"
      "/etc/nginx/nginx.conf"
      "-g"
      "daemon off;"
    ];
    Labels = {
      "org.opencontainers.image.title" = "Tool Atlas";
      "org.opencontainers.image.description" = "Zero-runtime static software catalog, comparison workspace, and script builder";
      "org.opencontainers.image.version" = staticSite.version;
      "org.opencontainers.image.revision" = self.rev or self.dirtyRev or "dirty";
      "org.opencontainers.image.source" = "https://github.com/ShalevZ923/ShalevSoftwareSite";
      "org.opencontainers.image.licenses" = "Apache-2.0";
    };
  };
}
