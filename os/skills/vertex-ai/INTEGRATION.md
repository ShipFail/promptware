# Vertex AI Skill Integration Guide

This guide demonstrates how an AI agent uses the Google Vertex AI skill within PromptWar̊e ØS.

## Skill Activation

When a user makes a request like:
- "Generate a video of..."
- "Create an image showing..."
- "Design a visual of..."

The agent should activate the Vertex AI skill by ingesting `os://skills/vertex-ai/SKILL.md`.

## Workflow Example

### Scenario 1: Video Generation Request

**User Request**: "Generate a video of a robot walking through a forest"

**Agent Process**:

1. **Activate Skill**
   ```
   Ingest: os://skills/vertex-ai/SKILL.md
   ```

2. **Identify Requirements**
   - Task: Video generation
   - Model: Veo 3.1
   - Prompt: "A robot walking through a forest"
   - Need: Project ID, authentication

3. **Check Authentication**
   ```bash
   deno run --allow-net --allow-env --allow-read \
     https://raw.githubusercontent.com/ShipFail/promptware/refs/heads/main/os/skills/vertex-ai/vertex-ai.ts \
     check-auth
   ```

4. **Handle Authentication Status**
   - If authenticated: Proceed to generation
   - If not: Guide user through setup:
     ```
     Please authenticate with Google Cloud:
     1. Run: gcloud auth application-default login
     2. Or set: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
     ```

5. **Execute Generation**
   ```bash
   deno run --allow-net --allow-env --allow-read \
     https://raw.githubusercontent.com/ShipFail/promptware/refs/heads/main/os/skills/vertex-ai/vertex-ai.ts \
     generate-video \
     --prompt "A humanoid robot walking through a lush green forest" \
     --project "user-project-id" \
     --duration "8s" \
     --style "cinematic"
   ```

6. **Handle Response**
   - Parse the JSON response
   - Extract video URL or job ID
   - Inform user of completion or provide job tracking info

### Scenario 2: Image Generation Request

**User Request**: "Create an image of a futuristic car"

**Agent Process**:

1. **Activate Skill**
   ```
   Ingest: os://skills/vertex-ai/SKILL.md
   ```

2. **Identify Requirements**
   - Task: Image generation
   - Model: Imagen
   - Prompt: "A futuristic car"
   - Optional: Style preferences

3. **Check Authentication** (same as video)

4. **Execute Generation**
   ```bash
   deno run --allow-net --allow-env --allow-read \
     https://raw.githubusercontent.com/ShipFail/promptware/refs/heads/main/os/skills/vertex-ai/vertex-ai.ts \
     generate-image \
     --prompt "A sleek futuristic electric car with aerodynamic design" \
     --project "user-project-id" \
     --style "photorealistic" \
     --resolution "1024x1024"
   ```

5. **Handle Response**
   - Parse the JSON response
   - Extract base64 image data or URL
   - Present image to user or save to file

## Error Handling Patterns

### Pattern 1: Missing Credentials
```
Error: No authentication token available

Agent Response:
"I need access to your Google Cloud credentials. Please set up authentication:

Option 1 (Recommended):
$ gcloud auth application-default login

Option 2 (Service Account):
$ export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json

After setting up, I'll retry the generation."
```

### Pattern 2: API Not Enabled
```
Error: HTTP 403 - Vertex AI API not enabled

Agent Response:
"The Vertex AI API is not enabled in your project. Please:

1. Visit: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com
2. Select your project: [project-id]
3. Click 'Enable'

Once enabled, I'll retry the generation."
```

### Pattern 3: Invalid Prompt
```
Error: Content policy violation

Agent Response:
"The prompt may have triggered content policy filters. Let me try:
1. Rephrasing the prompt to be more specific
2. Removing potentially sensitive terms
3. Using alternative descriptive language"
```

## Advanced Usage Patterns

### Multi-Step Generation

**User Request**: "Create a marketing video with matching thumbnail"

**Agent Process**:
1. Generate video first (Veo 3.1)
2. Wait for video completion
3. Generate thumbnail image (Imagen) matching video style
4. Present both assets to user

### Iterative Refinement

**User Request**: "Generate a video, but make it more cinematic"

**Agent Process**:
1. First attempt with basic prompt
2. Analyze user feedback
3. Refine prompt with "cinematic" style tag
4. Regenerate with enhanced parameters

### Batch Processing

**User Request**: "Generate 4 variations of a product image"

**Agent Process**:
1. Use `--num-images 4` parameter
2. Single API call generates multiple images
3. Present all variations to user
4. Allow user to select preferred version

## Best Practices for Agents

### 1. Prompt Enhancement
Always enhance user prompts with:
- Specific details (colors, mood, style)
- Technical specifications (resolution, duration)
- Contextual information (lighting, perspective)

Example transformation:
- User: "A car"
- Enhanced: "A sleek red sports car on a coastal highway at sunset with dramatic lighting"

### 2. Project Context Management
- Remember user's project ID across session
- Cache authentication status
- Store previously used parameters as defaults

### 3. Cost Awareness
- Inform user about approximate costs
- Suggest starting with shorter/smaller generations
- Recommend batch processing for similar requests

### 4. Progress Communication
- Video generation takes time - set expectations
- Provide status updates during processing
- Explain asynchronous job tracking

### 5. Error Recovery
- Always provide clear next steps
- Offer alternatives when errors occur
- Cache working configurations

## Integration with Other Skills

### Combining with Jekyll Skill
```
User: "Create a blog post with a video demo"

Agent:
1. Generate video (Vertex AI skill)
2. Create blog post (Jekyll skill)
3. Embed video in post assets
4. Verify and publish
```

### Combining with Vault Manager
```
User: "Generate images and store them securely"

Agent:
1. Generate images (Vertex AI skill)
2. Store in encrypted vault (Vault Manager skill)
3. Provide secure access links
```

## Monitoring and Debugging

### Logging
The tool outputs structured information:
- Request parameters
- API endpoints called
- Response data
- Error messages with context

### Debug Mode
For troubleshooting, agents should:
1. Check authentication first
2. Validate project configuration
3. Test with simple prompts
4. Review API response details

## Security Considerations

### Credential Handling
- Never log access tokens
- Use environment variables for credentials
- Recommend service accounts for production
- Guide users on proper key management

### Prompt Safety
- Validate prompts for policy compliance
- Warn about sensitive content
- Suggest alternatives for flagged content

### API Key Rotation
- Encourage regular credential rotation
- Support multiple authentication methods
- Handle token expiration gracefully

## Performance Optimization

### Caching Strategy
- Cache authentication tokens (respect TTL)
- Store successful prompt patterns
- Remember user preferences

### Region Selection
- Recommend nearest regions
- Fall back to default if unavailable
- Consider quota availability

### Request Batching
- Group similar requests
- Use multi-image generation
- Minimize API calls

## Future Enhancements

Potential additions to this skill:
1. **Model Selection**: Support for additional Vertex AI models
2. **Advanced Parameters**: More fine-grained control options
3. **Status Polling**: Automatic job status checking
4. **Result Storage**: Integrated file management
5. **Prompt Templates**: Pre-built prompt patterns
6. **Cost Estimation**: Preview costs before generation

## Resources

- Skill Documentation: `os://skills/vertex-ai/SKILL.md`
- Examples: `os://skills/vertex-ai/EXAMPLES.md`
- Tool: `os://skills/vertex-ai/vertex-ai.ts`
- Tests: `os://skills/vertex-ai/vertex-ai.test.ts`

## Support

For issues or questions:
1. Check EXAMPLES.md for troubleshooting
2. Review error messages for guidance
3. Consult Google Cloud documentation
4. Verify project and API configuration
