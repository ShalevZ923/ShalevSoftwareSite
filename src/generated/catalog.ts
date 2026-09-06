// Generated from content/catalog/**/{tool.json,guide.md,releases/*.json} by scripts/build-catalog.mjs. Do not edit manually.

export const tools = [
  {
    "id": "intellij",
    "name": "IntelliJ IDEA",
    "platforms": [
      "Windows",
      "Linux",
      "macOS"
    ],
    "lifecycle": "Current",
    "icon": "IJ",
    "updated": "Today",
    "description": "An intelligent IDE for JVM and web development, with code analysis, refactoring, Git tooling, and a mature plugin ecosystem.",
    "support": {
      "name": "Maya Cohen",
      "team": "Developer Experience",
      "initials": "MC",
      "email": "devex@atlas.local"
    },
    "tags": [
      "Java",
      "Kotlin",
      "IDE",
      "JetBrains"
    ],
    "facts": [
      {
        "label": "License",
        "value": "Named-user subscription"
      },
      {
        "label": "Asset record",
        "value": "DEV-IDE-001"
      },
      {
        "label": "Review cycle",
        "value": "Annual"
      }
    ],
    "company": "JetBrains",
    "category": "IDEs & Code Editors",
    "releases": [
      {
        "version": "2025.1",
        "download": "https://www.jetbrains.com/idea/download/"
      },
      {
        "version": "2026.01-Mac",
        "download": "https://www.jetbrains.com/idea/download/?section=mac"
      }
    ]
  },
  {
    "id": "vscode",
    "name": "Visual Studio Code",
    "platforms": [
      "Windows",
      "Linux",
      "macOS"
    ],
    "lifecycle": "Current",
    "icon": "VS",
    "updated": "Yesterday",
    "description": "A lightweight, extensible code editor for everyday development, remote workspaces, and team-standard extensions.",
    "support": {
      "name": "Maya Cohen",
      "team": "Developer Experience",
      "initials": "MC",
      "email": "devex@atlas.local"
    },
    "tags": [
      "IDE",
      "Editor",
      "Remote development",
      "Microsoft"
    ],
    "company": "Microsoft",
    "category": "IDEs & Code Editors",
    "releases": [
      {
        "version": "1.103",
        "download": "https://code.visualstudio.com/download"
      }
    ]
  },
  {
    "id": "docker",
    "name": "Docker Desktop",
    "platforms": [
      "Windows",
      "Linux",
      "macOS"
    ],
    "lifecycle": "Current",
    "icon": "DK",
    "updated": "3 days ago",
    "description": "Local container development with Docker Compose, image management, and a desktop dashboard for runtime inspection.",
    "support": {
      "name": "Noam Levi",
      "team": "Platform Engineering",
      "initials": "NL",
      "email": "platform@atlas.local"
    },
    "tags": [
      "Containers",
      "Runtime",
      "DevOps"
    ],
    "company": "Docker, Inc.",
    "category": "Containers",
    "releases": [
      {
        "version": "4.45",
        "download": "https://www.docker.com/products/docker-desktop/"
      }
    ]
  },
  {
    "id": "postman",
    "name": "Postman",
    "platforms": [
      "Windows",
      "Linux",
      "macOS",
      "Web"
    ],
    "lifecycle": "Current",
    "icon": "PM",
    "updated": "5 days ago",
    "description": "An API collaboration workspace for testing requests, sharing collections, and documenting integrations.",
    "support": {
      "name": "Rina Bar",
      "team": "Quality Engineering",
      "initials": "RB",
      "email": "quality@atlas.local"
    },
    "tags": [
      "API",
      "Testing",
      "Collections"
    ],
    "company": "Postman, Inc.",
    "category": "API Design",
    "releases": [
      {
        "version": "11.60",
        "download": "https://www.postman.com/downloads/"
      }
    ]
  },
  {
    "id": "wireshark",
    "name": "Wireshark",
    "platforms": [
      "Windows",
      "Linux",
      "macOS"
    ],
    "lifecycle": "Current",
    "icon": "WS",
    "updated": "Aug 18",
    "description": "Network protocol analyzer for capture, inspection, and troubleshooting across common protocols.",
    "support": {
      "name": "Avi Shaham",
      "team": "Infrastructure",
      "initials": "AS",
      "email": "infra@atlas.local"
    },
    "tags": [
      "Network",
      "Debugging",
      "Security"
    ],
    "company": "Wireshark Foundation",
    "category": "Infrastructure Diagnostics",
    "releases": [
      {
        "version": "4.4",
        "download": "https://www.wireshark.org/download.html"
      }
    ]
  },
  {
    "id": "jmeter",
    "name": "Apache JMeter",
    "platforms": [
      "Windows",
      "Linux",
      "macOS"
    ],
    "lifecycle": "Legacy",
    "icon": "JM",
    "updated": "Aug 02",
    "description": "A mature open-source tool for load testing, functional testing, and protocol-level performance analysis.",
    "support": {
      "name": "Rina Bar",
      "team": "Quality Engineering",
      "initials": "RB",
      "email": "quality@atlas.local"
    },
    "tags": [
      "Load testing",
      "Performance",
      "Apache"
    ],
    "company": "Apache Software Foundation",
    "category": "Performance Testing",
    "releases": [
      {
        "version": "5.6.3",
        "download": "https://jmeter.apache.org/download_jmeter.cgi"
      }
    ]
  },
  {
    "id": "dbeaver",
    "name": "DBeaver Community",
    "platforms": [
      "Windows",
      "Linux",
      "macOS"
    ],
    "lifecycle": "New",
    "icon": "DB",
    "updated": "Jul 29",
    "description": "Universal database management for exploring data, editing schemas, and running SQL across common engines.",
    "support": {
      "name": "Tomer Gil",
      "team": "Data Platform",
      "initials": "TG",
      "email": "data@atlas.local"
    },
    "tags": [
      "Database",
      "SQL",
      "New"
    ],
    "company": "DBeaver Corp",
    "category": "Database Tools",
    "releases": [
      {
        "version": "25.1",
        "download": "https://dbeaver.io/download/"
      }
    ]
  },
  {
    "id": "nginx",
    "name": "NGINX",
    "platforms": [
      "Linux"
    ],
    "lifecycle": "Current",
    "icon": "NX",
    "updated": "Jul 15",
    "description": "A high-performance web server, reverse proxy, and load balancer for internal application delivery.",
    "support": {
      "name": "Avi Shaham",
      "team": "Infrastructure",
      "initials": "AS",
      "email": "infra@atlas.local"
    },
    "tags": [
      "Server",
      "Reverse proxy",
      "Linux"
    ],
    "company": "F5, Inc.",
    "category": "Web & Edge Infrastructure",
    "releases": [
      {
        "version": "1.28",
        "download": "https://nginx.org/en/download.html"
      }
    ]
  },
  {
    "id": "jq",
    "name": "jq",
    "platforms": [
      "Windows"
    ],
    "lifecycle": "New",
    "icon": "JQ",
    "updated": "Today",
    "description": "A lightweight command-line JSON processor, hosted here as the same-server download proof of concept.",
    "support": {
      "name": "Noam Levi",
      "team": "Platform Engineering",
      "initials": "NL",
      "email": "platform@atlas.local"
    },
    "tags": [
      "JSON",
      "CLI",
      "Windows",
      "PoC"
    ],
    "company": "jqlang",
    "category": "Debuggers",
    "releases": [
      {
        "version": "1.8.2",
        "artifact": "jq/1.8.2/jq-windows-amd64.exe"
      }
    ]
  }
];

export const docs = {
  "intellij": "# IntelliJ IDEA\n\nIntelliJ IDEA is the supported default for JVM development. It is licensed through the internal developer portal.\n\n## Install\n\n1. Download the **Ultimate** edition from [JetBrains](https://www.jetbrains.com/idea/download/).\n2. Sign in using your approved JetBrains account.\n3. Import the [team settings repository](https://github.com/) when prompted.\n\n> Need an additional plugin? Check its ownership and compatibility before installing it on a managed workstation.\n\n## Standard add-ons\n\n| Add-on | Use | Owner |\n| --- | --- | --- |\n| SonarLint | Local quality feedback | Quality Engineering |\n| Kubernetes | Cluster manifests | Platform Engineering |\n| Database Tools | SQL exploration | Data Platform |\n\n## Support\n\nContact Developer Experience for licensing, onboarding, or standard configuration. Include your operating system and IDE version in the request.",
  "vscode": "# Visual Studio Code\n\nVisual Studio Code is the supported editor for lightweight projects and remote development.\n\n## Install\n\nInstall the current stable release, then sign in to Settings Sync with your approved account. The recommended extension profile is available in the internal setup guide.\n\n## When to use it\n\n- TypeScript, documentation, and scripting\n- Container or remote workspace development\n- Quick repository exploration\n\n## Support\n\nDeveloper Experience owns the standard extension profile and editor configuration.",
  "docker": "# Docker Desktop\n\nDocker Desktop provides the supported local container runtime for macOS and Windows. Linux hosts can use Docker Engine where appropriate.\n\n## Install\n\n1. Confirm virtualization is enabled.\n2. Sign in using your approved organization account.\n3. Run `docker version` and `docker compose version`.\n\n## Support\n\nPlatform Engineering supports the approved runtime and base configuration. Application teams own their compose files and images.",
  "postman": "# Postman\n\nPostman is used for API exploration and team-shared test collections. Keep secrets in the approved secret manager; do not save tokens in shared environments.\n\n## Install\n\nInstall the current stable release and use the approved workspace for shared collections.\n\n## Support\n\n- Use environment variables for credentials.\n- Keep shared collections free of personal data.\n- Review imported collections before sending requests.",
  "wireshark": "# Wireshark\n\nWireshark is approved for diagnostic packet capture. Capture only traffic you are authorized to inspect and follow the data-handling policy.\n\n## Install\n\nDownload the supported current release for your operating system from the vendor site.\n\n## Support\n\nInfrastructure supports approved diagnostic use and data-handling guidance.",
  "jmeter": "# Apache JMeter\n\nApache JMeter remains available for maintained load-test suites. For new browser-level performance checks, consult Quality Engineering for the preferred approach.\n\n## Install\n\nUse the current approved release for maintained test suites.\n\n## Support\n\nQuality Engineering supports the maintained load-test templates and performance-testing guidance.",
  "dbeaver": "# DBeaver Community\n\nDBeaver is the current recommended cross-platform database client. Store connection details in your local secure storage and request least-privileged accounts.\n\n## Install\n\nDownload the approved current release and use local secure storage for connections.\n\n## Support\n\nData Platform supports standard connection patterns and least-privileged access requests.",
  "nginx": "# NGINX\n\nNGINX is supported for approved Linux web-delivery workloads. Platform Engineering owns base images, security updates, and common reverse-proxy patterns.\n\n## Install\n\nUse the Platform Engineering base image or approved package repository. Do not use unmaintained community images for production services.\n\n## Support\n\nPlatform Engineering supports base images, security updates, and standard reverse-proxy patterns.",
  "jq": "# jq\n\nThis entry proves that Tool Atlas can serve a reviewed installer directly from its own package storage instead of redirecting to a vendor URL.\n\n## Install\n\n1. Select version **1.8.2** and choose **Download**.\n2. Save `jq-windows-amd64.exe` to an approved directory.\n3. Rename it to `jq.exe` if desired and add that directory to `PATH` according to workstation policy.\n4. Run `jq --version` and confirm it reports `jq-1.8.2`.\n\nThe proof-of-concept publisher validates the official SHA-256 digest before the file becomes visible under `/downloads/jq/1.8.2/`.\n\n## Support\n\nContact Platform Engineering if the checksum fails, the download is unavailable, or a different Windows architecture is required."
};
