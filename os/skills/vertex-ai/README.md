# Google Vertex AI Skill

This skill provides integration with Google Cloud Vertex AI's generative AI capabilities.

## Overview

The Vertex AI skill enables agents to generate:
- **Videos** using the Veo 3.1 model
- **Images** using the Imagen model family

## Files

- `SKILL.md` - Main skill specification and documentation
- `vertex-ai.ts` - Command-line tool for Vertex AI API integration
- `README.md` - This file

## Quick Start

### Prerequisites

1. Google Cloud project with billing enabled
2. Vertex AI API enabled in your project
3. Authentication configured (see Authentication section)

### Authentication

Set up Google Cloud authentication using one of these methods:

#### Method 1: Application Default Credentials (Recommended)
```bash
gcloud auth application-default login
```

#### Method 2: Service Account
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

#### Method 3: OAuth 2.0
Visit the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) to set up OAuth credentials.

### Usage Examples

#### Check Authentication
```bash
deno run --allow-net --allow-env --allow-read vertex-ai.ts check-auth
```

#### Generate a Video
```bash
deno run --allow-net --allow-env --allow-read vertex-ai.ts generate-video \
  --prompt "A serene sunset over mountains" \
  --project "your-project-id" \
  --location "us-central1" \
  --duration "5s"
```

#### Generate an Image
```bash
deno run --allow-net --allow-env --allow-read vertex-ai.ts generate-image \
  --prompt "A futuristic cityscape at night" \
  --project "your-project-id" \
  --location "us-central1" \
  --style "photorealistic"
```

## Architecture

This skill follows the PromptWar̊e ØS architecture:

- **Zero-Footprint**: No downloads required, runs remotely via `deno run <url>`
- **Stateless**: Each invocation is independent
- **JSR Imports**: Uses standard Deno JSR packages
- **CLI Standard**: Supports `--help` for all commands

## API Endpoints

The tool interacts with these Vertex AI endpoints:

- Video Generation: `publishers/google/models/veo-3.1:predict`
- Image Generation: `publishers/google/models/imagegeneration:predict`

## Supported Models

- **Veo 3.1**: Advanced video generation model
- **Imagen**: High-quality image generation model family

## Development

### Testing

To test the tool locally:

```bash
# Check help output
deno run vertex-ai.ts --help

# Test authentication check
deno run --allow-net --allow-env --allow-read vertex-ai.ts check-auth
```

### Adding New Features

When adding new capabilities:

1. Update `vertex-ai.ts` with new command handlers
2. Update `SKILL.md` with usage documentation
3. Add examples to this README
4. Test with `--help` flag

## Limitations

- Requires active Google Cloud billing account
- Subject to Vertex AI API quotas
- Video generation is asynchronous and may take minutes
- Regional availability varies by model

## License

Copyright (c) 2025 Ship.Fail  
Licensed under the Public Prompt License - Apache Variant (PPL-A)

See the LICENSE file in the repository root for details.
