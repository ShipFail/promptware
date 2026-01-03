---
type: skill
title: "Google Vertex AI Module"
version: "0.1.0"
tags:
  - vertex-ai
  - google-cloud
  - ai-generation
  - video
  - image
tools:
  - ./vertex-ai.ts
---

This skill enables you to leverage Google Cloud Vertex AI's powerful generative AI capabilities, including video generation with Veo 3.1 and image generation with Imagen models.

---

## When to use this skill

Use this skill whenever you are asked to:

* Generate videos from text descriptions
* Create images from text prompts
* Design visual content using AI models
* Utilize Google Cloud's Vertex AI generative capabilities

If the user's request involves video or image generation and mentions Google Cloud or Vertex AI, this is the primary skill to activate.

---

## Capabilities

### Video Generation (Veo 3.1)
* Generate high-quality videos from text prompts
* Support for various video styles and durations
* Advanced video synthesis capabilities

### Image Generation (Imagen)
* Create images from text descriptions
* Support for various styles and resolutions
* High-quality image synthesis

---

## Authentication

This skill requires Google Cloud authentication. The tool will:

1. **Check for existing credentials**: Automatically detect Application Default Credentials (ADC)
2. **Provide setup instructions**: If credentials are missing, display OAuth login URL and setup steps
3. **Guide authentication**: Walk you through the Google Cloud authentication flow

**Important Limitation**: Service account JWT authentication is not yet fully implemented. Please use the gcloud CLI method for authentication.

### Setting up authentication

If you haven't authenticated yet, you'll need to:

1. Have a Google Cloud project with Vertex AI API enabled
2. Set up Application Default Credentials using the recommended method:
   * **Recommended**: Run `gcloud auth application-default login`
   * Alternative: Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable (requires gcloud CLI as fallback)

**Note**: Service account JSON key files are detected but not yet supported for direct authentication. The tool will guide you to use gcloud CLI instead.

The tool will detect your authentication status and provide specific instructions if needed.

---

## Inputs and outputs

### Inputs you should expect

* **For video generation**:
  * Text prompt describing the video to generate
  * Optional: Duration, style preferences, aspect ratio
  * Google Cloud project ID
  * Location/region (default: us-central1)

* **For image generation**:
  * Text prompt describing the image to create
  * Optional: Style, resolution, number of images
  * Google Cloud project ID
  * Location/region (default: us-central1)

### Outputs you must produce

* **For video generation**:
  * Video file URL or download link
  * Generation metadata (model used, parameters)
  * Status and completion information

* **For image generation**:
  * Image file URL(s) or base64-encoded data
  * Generation metadata
  * Status information

---

## Tool Usage

### Library Functions

| Function | Tool Path | Description |
| :--- | :--- | :--- |
| `vertex-ai` | `os://skills/vertex-ai/vertex-ai.ts` | Main tool for interacting with Vertex AI APIs |

### Command Structure

The `vertex-ai.ts` tool supports the following operations:

```bash
# Generate a video
deno run --allow-net --allow-env --allow-read vertex-ai.ts generate-video \
  --prompt "A serene sunset over mountains" \
  --project "your-project-id" \
  --location "us-central1"

# Generate an image
deno run --allow-net --allow-env --allow-read vertex-ai.ts generate-image \
  --prompt "A futuristic cityscape" \
  --project "your-project-id" \
  --location "us-central1"

# Check authentication status
deno run --allow-net --allow-env --allow-read vertex-ai.ts check-auth

# Show help
deno run vertex-ai.ts --help
```

---

## Workflow

When a user requests video or image generation:

1. **Understand the request**
   * Identify if it's video or image generation
   * Extract the text prompt
   * Note any specific requirements (style, duration, resolution)

2. **Check authentication**
   * Use the tool to verify Google Cloud credentials
   * If not authenticated, guide the user through setup

3. **Generate content**
   * Call the appropriate generation command
   * Pass the prompt and any parameters
   * Monitor the generation process

4. **Deliver results**
   * Provide the generated content URL or data
   * Share any relevant metadata
   * Confirm successful generation

---

## Error Handling

The tool handles common errors:

* **Authentication errors**: Provides clear setup instructions
* **API errors**: Displays error messages and suggests fixes
* **Network errors**: Indicates connectivity issues
* **Permission errors**: Guides on enabling Vertex AI API

Always check the tool's output for specific error messages and follow the suggested remediation steps.

---

## Examples

### Example 1: Generate a video

```bash
# User request: "Generate a video of a robot walking through a forest"
deno run --allow-net --allow-env --allow-read vertex-ai.ts generate-video \
  --prompt "A humanoid robot walking through a lush green forest" \
  --project "my-project" \
  --duration "5s"
```

### Example 2: Generate an image

```bash
# User request: "Create an image of a futuristic car"
deno run --allow-net --allow-env --allow-read vertex-ai.ts generate-image \
  --prompt "A sleek futuristic electric car in chrome finish" \
  --project "my-project" \
  --style "photorealistic"
```

---

## Best Practices

1. **Clear prompts**: Use descriptive, specific prompts for better results
2. **Project setup**: Ensure Vertex AI API is enabled in your Google Cloud project
3. **Region selection**: Choose a region close to your location for better performance
4. **Cost awareness**: Video and image generation incur costs; monitor your usage
5. **Prompt refinement**: Iterate on prompts to achieve desired results

---

## Limitations

* Requires active Google Cloud project with billing enabled
* Subject to Vertex AI API quotas and limits
* Video generation may take several minutes depending on duration
* Content must comply with Google Cloud's usage policies
* Some features may be region-specific
* **Service account JWT authentication not yet implemented** - use gcloud CLI instead
* Maximum 10 images per generation request (use multiple requests for more)

---

## Non-goals

This skill does **not**:

* Manage Google Cloud project setup or billing
* Store or manage generated content long-term
* Provide video or image editing capabilities
* Handle content moderation or filtering
* Manage API quotas or cost optimization

Those aspects are the responsibility of the user's Google Cloud configuration and organizational policies.
