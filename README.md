# rfs-proj-sub

RFS Project Sub-services Repository

## Overview

This repository contains microservices and utilities for the RFS project, primarily focused on data processing and analytics services deployed on Google Cloud Platform.

## Services

### 1. imp-log-etl
BigQuery-based ETL service for processing digital signage impression logs.

- **Location**: `services/cloud-run/imp-log-etl/`
- **Technology**: Node.js/TypeScript, BigQuery, Cloud Run
- **Purpose**: Daily aggregation of signage impression data

[View Service Documentation](services/cloud-run/imp-log-etl/DEPLOYMENT.md)

## Repository Structure

```
rfs-proj-sub/
├── services/
│   └── cloud-run/
│       └── imp-log-etl/        # Impression Log ETL Service
└── credentials/                 # Local credentials (git-ignored)
```

## Getting Started

### Prerequisites

- Node.js 18 or higher
- Google Cloud SDK
- Access to GCP Project: `rfs-proj`

### Setup

1. Clone the repository
```bash
git clone https://github.com/[your-org]/rfs-proj-sub.git
cd rfs-proj-sub
```

2. Navigate to the service you want to work with
```bash
cd services/cloud-run/imp-log-etl
```

3. Install dependencies
```bash
npm install
```

4. Follow service-specific setup instructions in the service's README or DEPLOYMENT.md

## Development

Each service has its own development environment and commands. Refer to the service-specific documentation for details.

### Common Commands

Most services support these standard npm scripts:
- `npm run dev` - Start development server
- `npm test` - Run tests
- `npm run build` - Build for production
- `npm run deploy:dev` - Deploy to development environment

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure tests pass
4. Submit a pull request

## License

Private repository - All rights reserved