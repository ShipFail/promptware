# Changelog - Google Vertex AI Skill

All notable changes to the Vertex AI skill will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-12-24

### Added
- Initial release of Google Vertex AI skill for PromptWar̊e ØS
- Video generation support using Veo 3.1 model
  - Text-to-video generation
  - Duration control (customizable video length)
  - Style customization (cinematic, vibrant, etc.)
  - Aspect ratio support (16:9, 9:16, 1:1)
- Image generation support using Imagen model
  - Text-to-image generation
  - Style options (photorealistic, artistic, product-design)
  - Resolution control
  - Multiple image generation (batch processing)
- Authentication handling
  - Application Default Credentials (ADC) detection
  - Service account support via GOOGLE_APPLICATION_CREDENTIALS
  - gcloud CLI integration
  - OAuth 2.0 guidance and setup instructions
- Error handling and user guidance
  - Clear error messages with troubleshooting steps
  - Authentication status checking
  - API error interpretation
  - Permission and quota guidance
- Command-line tool (`vertex-ai.ts`)
  - Standard `--help` flag support
  - Three main commands: `generate-video`, `generate-image`, `check-auth`
  - JSR-based imports (jsr:@std/cli/parse-args)
  - Remote execution support (no download required)
- Documentation
  - SKILL.md: Complete skill specification
  - README.md: Quick start guide
  - EXAMPLES.md: Comprehensive examples and best practices
  - INTEGRATION.md: Agent integration patterns
  - CHANGELOG.md: Version history
- Testing
  - vertex-ai.test.ts: Unit tests and behavior documentation
  - Structure validation tests
  - Help message format verification

### Technical Details
- Language: TypeScript
- Runtime: Deno
- Architecture: Stateless, microservice-based
- API Integration: Google Cloud Vertex AI REST API
- Authentication: Google Cloud OAuth 2.0 / ADC
- License: Public Prompt License - Apache Variant (PPL-A)

### API Endpoints
- Video: `publishers/google/models/veo-3.1:predict`
- Image: `publishers/google/models/imagegeneration:predict`

### Supported Models
- Veo 3.1 (Video generation)
- Imagen (Image generation)

### Dependencies
- jsr:@std/cli@^1.0.0 (parseArgs)
- Deno standard library
- Google Cloud Vertex AI API

### Known Limitations
- Requires active Google Cloud project with billing
- Subject to Vertex AI API quotas
- Video generation is asynchronous and may take several minutes
- Regional availability varies by model
- Service account JWT authentication not fully implemented (uses gcloud CLI as fallback)

### Future Roadmap
See INTEGRATION.md for planned enhancements:
- Additional model support
- Advanced parameter controls
- Automatic status polling
- Integrated file management
- Prompt templates library
- Cost estimation features

## [Unreleased]

### Planned for 0.2.0
- Full service account JWT authentication implementation
- Job status polling with automatic completion detection
- File download and storage integration
- Enhanced prompt templates
- Cost estimation before generation
- Support for additional Imagen model variants

### Under Consideration
- Video editing capabilities (trim, merge)
- Image post-processing (resize, filter)
- Prompt suggestion engine
- Result caching mechanism
- Multi-region failover
- Quota management tools

---

## Version History

- **0.1.0** (2025-12-24): Initial release with video and image generation

---

## Contributing

When contributing to this skill:

1. Update this CHANGELOG with your changes
2. Follow [Semantic Versioning](https://semver.org/)
3. Add entries under [Unreleased] until release
4. Move changes to a new version section on release
5. Update version in SKILL.md frontmatter

### Changelog Categories

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security vulnerability fixes

---

## License

Copyright (c) 2025 Ship.Fail  
Licensed under the Public Prompt License - Apache Variant (PPL-A)

See the LICENSE file in the repository root for details.
