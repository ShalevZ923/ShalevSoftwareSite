// Generated from content/tools/*.md by scripts/build-catalog.mjs. Do not edit manually.

export const tools = [
  {
    "id": "intellij",
    "name": "IntelliJ IDEA",
    "company": "JetBrains",
    "category": "IDE",
    "platforms": [
      "Windows",
      "Linux",
      "macOS"
    ],
    "lifecycle": "Current",
    "icon": "IJ",
    "version": "2025.1",
    "updated": "Today",
    "description": "An intelligent IDE for JVM and web development, with code analysis, refactoring, Git tooling, and a mature plugin ecosystem.",
    "support": {
      "name": "Maya Cohen",
      "team": "Developer Experience",
      "initials": "MC",
      "email": "devex@atlas.local"
    },
    "download": "https://www.jetbrains.com/idea/download/",
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
    ]
  },
  {
    "id": "vscode",
    "name": "Visual Studio Code",
    "company": "Microsoft",
    "category": "IDE",
    "platforms": [
      "Windows",
      "Linux",
      "macOS"
    ],
    "lifecycle": "Current",
    "icon": "VS",
    "version": "1.103",
    "updated": "Yesterday",
    "description": "A lightweight, extensible code editor for everyday development, remote workspaces, and team-standard extensions.",
    "support": {
      "name": "Maya Cohen",
      "team": "Developer Experience",
      "initials": "MC",
      "email": "devex@atlas.local"
    },
    "download": "https://code.visualstudio.com/download",
    "tags": [
      "IDE",
      "Editor",
      "Remote development",
      "Microsoft"
    ]
  },
  {
    "id": "docker",
    "name": "Docker Desktop",
    "company": "Docker, Inc.",
    "category": "Containers",
    "platforms": [
      "Windows",
      "Linux",
      "macOS"
    ],
    "lifecycle": "Current",
    "icon": "DK",
    "version": "4.45",
    "updated": "3 days ago",
    "description": "Local container development with Docker Compose, image management, and a desktop dashboard for runtime inspection.",
    "support": {
      "name": "Noam Levi",
      "team": "Platform Engineering",
      "initials": "NL",
      "email": "platform@atlas.local"
    },
    "download": "https://www.docker.com/products/docker-desktop/",
    "tags": [
      "Containers",
      "Runtime",
      "DevOps"
    ]
  },
  {
    "id": "postman",
    "name": "Postman",
    "company": "Postman, Inc.",
    "category": "API testing",
    "platforms": [
      "Windows",
      "Linux",
      "macOS",
      "Web"
    ],
    "lifecycle": "Current",
    "icon": "PM",
    "version": "11.60",
    "updated": "5 days ago",
    "description": "An API collaboration workspace for testing requests, sharing collections, and documenting integrations.",
    "support": {
      "name": "Rina Bar",
      "team": "Quality Engineering",
      "initials": "RB",
      "email": "quality@atlas.local"
    },
    "download": "https://www.postman.com/downloads/",
    "tags": [
      "API",
      "Testing",
      "Collections"
    ]
  },
  {
    "id": "wireshark",
    "name": "Wireshark",
    "company": "Wireshark Foundation",
    "category": "Debugging",
    "platforms": [
      "Windows",
      "Linux",
      "macOS"
    ],
    "lifecycle": "Current",
    "icon": "WS",
    "version": "4.4",
    "updated": "Aug 18",
    "description": "Network protocol analyzer for capture, inspection, and troubleshooting across common protocols.",
    "support": {
      "name": "Avi Shaham",
      "team": "Infrastructure",
      "initials": "AS",
      "email": "infra@atlas.local"
    },
    "download": "https://www.wireshark.org/download.html",
    "tags": [
      "Network",
      "Debugging",
      "Security"
    ]
  },
  {
    "id": "jmeter",
    "name": "Apache JMeter",
    "company": "Apache Software Foundation",
    "category": "Performance testing",
    "platforms": [
      "Windows",
      "Linux",
      "macOS"
    ],
    "lifecycle": "Legacy",
    "icon": "JM",
    "version": "5.6.3",
    "updated": "Aug 02",
    "description": "A mature open-source tool for load testing, functional testing, and protocol-level performance analysis.",
    "support": {
      "name": "Rina Bar",
      "team": "Quality Engineering",
      "initials": "RB",
      "email": "quality@atlas.local"
    },
    "download": "https://jmeter.apache.org/download_jmeter.cgi",
    "tags": [
      "Load testing",
      "Performance",
      "Apache"
    ]
  },
  {
    "id": "dbeaver",
    "name": "DBeaver Community",
    "company": "DBeaver Corp",
    "category": "Database",
    "platforms": [
      "Windows",
      "Linux",
      "macOS"
    ],
    "lifecycle": "New",
    "icon": "DB",
    "version": "25.1",
    "updated": "Jul 29",
    "description": "Universal database management for exploring data, editing schemas, and running SQL across common engines.",
    "support": {
      "name": "Tomer Gil",
      "team": "Data Platform",
      "initials": "TG",
      "email": "data@atlas.local"
    },
    "download": "https://dbeaver.io/download/",
    "tags": [
      "Database",
      "SQL",
      "New"
    ]
  },
  {
    "id": "nginx",
    "name": "NGINX",
    "company": "F5, Inc.",
    "category": "Server",
    "platforms": [
      "Linux"
    ],
    "lifecycle": "Current",
    "icon": "NX",
    "version": "1.28",
    "updated": "Jul 15",
    "description": "A high-performance web server, reverse proxy, and load balancer for internal application delivery.",
    "support": {
      "name": "Avi Shaham",
      "team": "Infrastructure",
      "initials": "AS",
      "email": "infra@atlas.local"
    },
    "download": "https://nginx.org/en/download.html",
    "tags": [
      "Server",
      "Reverse proxy",
      "Linux"
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
  "nginx": "# NGINX\n\nNGINX is supported for approved Linux web-delivery workloads. Platform Engineering owns base images, security updates, and common reverse-proxy patterns.\n\n## Install\n\nUse the Platform Engineering base image or approved package repository. Do not use unmaintained community images for production services.\n\n## Support\n\nPlatform Engineering supports base images, security updates, and standard reverse-proxy patterns."
};
