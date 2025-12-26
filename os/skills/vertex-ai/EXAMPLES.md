# Google Vertex AI Configuration Examples

This file contains example configurations for using the Vertex AI skill.

## Environment Variables

```bash
# Set your Google Cloud project ID
export GCP_PROJECT_ID="your-project-id"

# Set default location/region
export GCP_LOCATION="us-central1"

# For service account authentication
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

## Example Prompts

### Video Generation Examples

#### Example 1: Nature Scene
```bash
deno run --allow-net --allow-env --allow-read vertex-ai.ts generate-video \
  --prompt "A serene sunset over snow-capped mountains with a lake reflecting the golden sky" \
  --project "$GCP_PROJECT_ID" \
  --duration "8s" \
  --style "cinematic"
```

#### Example 2: Technology Demo
```bash
deno run --allow-net --allow-env --allow-read vertex-ai.ts generate-video \
  --prompt "A humanoid robot assembling electronic components in a modern factory" \
  --project "$GCP_PROJECT_ID" \
  --duration "10s" \
  --aspect-ratio "16:9"
```

#### Example 3: Urban Scene
```bash
deno run --allow-net --allow-env --allow-read vertex-ai.ts generate-video \
  --prompt "Time-lapse of a busy city street at night with neon lights and traffic" \
  --project "$GCP_PROJECT_ID" \
  --duration "5s" \
  --style "vibrant"
```

### Image Generation Examples

#### Example 1: Photorealistic
```bash
deno run --allow-net --allow-env --allow-read vertex-ai.ts generate-image \
  --prompt "A photorealistic portrait of a person in a futuristic spacesuit on Mars" \
  --project "$GCP_PROJECT_ID" \
  --style "photorealistic" \
  --resolution "1024x1024"
```

#### Example 2: Artistic Style
```bash
deno run --allow-net --allow-env --allow-read vertex-ai.ts generate-image \
  --prompt "An abstract painting of a city skyline at sunset in vibrant colors" \
  --project "$GCP_PROJECT_ID" \
  --style "artistic" \
  --num-images 4
```

#### Example 3: Product Design
```bash
deno run --allow-net --allow-env --allow-read vertex-ai.ts generate-image \
  --prompt "A sleek minimalist smartwatch with a transparent display" \
  --project "$GCP_PROJECT_ID" \
  --style "product-design" \
  --resolution "512x512"
```

## Common Use Cases

### 1. Marketing Content
Generate promotional videos and images for products or services.

### 2. Concept Visualization
Create visual representations of ideas, concepts, or designs.

### 3. Storyboarding
Generate scenes for video storyboards or presentations.

### 4. Social Media Content
Create engaging visual content for social media platforms.

### 5. Prototyping
Quickly visualize design concepts without manual creation.

## Best Practices

### Prompt Engineering

1. **Be Specific**: Include details about subject, setting, style, and mood
   - ❌ "A car"
   - ✅ "A sleek red sports car driving on a coastal highway at sunset"

2. **Use Descriptive Language**: Add adjectives and context
   - ❌ "A building"
   - ✅ "A modern glass skyscraper with curved architecture reflecting clouds"

3. **Specify Style**: Mention the desired artistic or visual style
   - Examples: "photorealistic", "cinematic", "artistic", "minimalist"

4. **Include Composition Details**: Describe camera angles, lighting, etc.
   - "viewed from above", "soft lighting", "wide angle shot"

### Performance Optimization

1. **Start Small**: Begin with shorter videos and lower resolutions to test
2. **Choose Appropriate Regions**: Use regions closest to your location
3. **Batch Requests**: Group similar generation requests together
4. **Monitor Quotas**: Keep track of API usage and quotas

### Cost Management

1. **Use Development Projects**: Test with separate GCP projects
2. **Set Budget Alerts**: Configure billing alerts in Google Cloud Console
3. **Cache Results**: Save generated content to avoid regeneration
4. **Optimize Prompts**: Refine prompts to reduce iteration count

## Troubleshooting

### Authentication Issues

**Problem**: "No authentication token available"
**Solution**: Run `gcloud auth application-default login` or set `GOOGLE_APPLICATION_CREDENTIALS`

**Problem**: "Permission denied"
**Solution**: Ensure your account has the `aiplatform.endpoints.predict` permission

### API Errors

**Problem**: "API not enabled"
**Solution**: Enable Vertex AI API at https://console.cloud.google.com/apis/library/aiplatform.googleapis.com

**Problem**: "Quota exceeded"
**Solution**: Check your quota limits in the GCP Console and request increases if needed

### Generation Issues

**Problem**: "Generation failed"
**Solution**: Review your prompt for policy violations or clarity issues

**Problem**: "Long generation time"
**Solution**: Video generation can take several minutes; check job status with returned job ID

## Additional Resources

- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Veo Model Documentation](https://cloud.google.com/vertex-ai/docs/generative-ai/video/overview)
- [Imagen Documentation](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview)
- [Google Cloud Pricing](https://cloud.google.com/vertex-ai/pricing)
