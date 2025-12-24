#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * vertex-ai.ts
 * Google Vertex AI integration tool for PromptWar̊e ØS
 * Copyright (c) 2025 Ship.Fail
 * Licensed under the Public Prompt License - Apache Variant (PPL-A)
 */

import { parseArgs } from "jsr:@std/cli/parse-args";

// Model constants
const MODEL_VEO_3_1 = "veo-3.1";
const MODEL_IMAGEN = "imagegeneration";

// Validation constants
const MAX_NUM_IMAGES = 10;

// Type definitions
interface VideoPrediction {
  videoUri?: string;
  jobId?: string;
}

interface ImagePrediction {
  bytesBase64Encoded?: string;
  imageUri?: string;
}

interface VertexAIConfig {
  project: string;
  location: string;
  apiEndpoint: string;
}

const HELP_MESSAGE = `
vertex-ai - Google Vertex AI Module Tool

Usage:
  vertex-ai <command> [options]

Commands:
  generate-video    Generate a video using Veo 3.1 model
  generate-image    Generate an image using Imagen model
  check-auth        Check authentication status

Options:
  --help, -h           Show this help message
  --prompt, -p         Text prompt for generation (required for generate-*)
  --project            Google Cloud project ID (required)
  --location, -l       Region location (default: us-central1)
  --duration, -d       Video duration (e.g., "5s", "10s")
  --style, -s          Style for generation (e.g., "photorealistic", "cinematic")
  --aspect-ratio, -a   Aspect ratio (e.g., "16:9", "9:16", "1:1")
  --resolution, -r     Image resolution (e.g., "1024x1024", "512x512")
  --num-images, -n     Number of images to generate (default: 1)

Examples:
  # Generate a video
  vertex-ai generate-video \\
    --prompt "A robot walking through a forest" \\
    --project "my-project" \\
    --duration "5s"

  # Generate an image
  vertex-ai generate-image \\
    --prompt "A futuristic cityscape" \\
    --project "my-project" \\
    --style "photorealistic"

  # Check authentication
  vertex-ai check-auth

Authentication:
  This tool requires Google Cloud authentication. Set up credentials using:
  - gcloud auth application-default login (recommended)
  - GOOGLE_APPLICATION_CREDENTIALS environment variable
  
  Note: Service account JWT authentication is not yet implemented.
  Please use gcloud CLI for authentication.
`;

interface VertexAIConfig {
  project: string;
  location: string;
  apiEndpoint: string;
}

/**
 * Get access token from Application Default Credentials
 * Note: Service account JWT authentication is not fully implemented
 */
async function getAccessToken(): Promise<string | null> {
  try {
    // Try to get credentials from environment
    const credsPath = Deno.env.get("GOOGLE_APPLICATION_CREDENTIALS");
    
    if (credsPath) {
      const credsContent = await Deno.readTextFile(credsPath);
      const creds = JSON.parse(credsContent);
      
      // For service account, we need to create a JWT and exchange for access token
      // This functionality is not yet implemented
      if (creds.type === "service_account") {
        console.error("✗ Service account JWT authentication not implemented");
        console.error("\nPlease use gcloud CLI instead:");
        console.error("  $ gcloud auth application-default login");
        console.error("\nAlternatively, use user credentials instead of a service account.");
        return null;
      }
    }

    // Try to use gcloud command if available
    const command = new Deno.Command("gcloud", {
      args: ["auth", "application-default", "print-access-token"],
      stdout: "piped",
      stderr: "piped",
    });

    const output = await command.output();
    
    if (output.success) {
      const token = new TextDecoder().decode(output.stdout).trim();
      return token;
    }

    return null;
  } catch (_error) {
    return null;
  }
}

/**
 * Check authentication status
 */
async function checkAuth(): Promise<boolean> {
  console.log("Checking Google Cloud authentication...\n");

  const token = await getAccessToken();

  if (token) {
    console.log("✓ Authentication successful!");
    console.log("✓ Access token obtained");
    return true;
  } else {
    console.log("✗ Authentication failed or not configured\n");
    console.log("To set up authentication, use one of these methods:\n");
    console.log("1. Application Default Credentials (ADC):");
    console.log("   $ gcloud auth application-default login\n");
    console.log("2. Service Account:");
    console.log("   $ export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json\n");
    console.log("3. OAuth 2.0 (for interactive use):");
    console.log("   Visit: https://console.cloud.google.com/apis/credentials\n");
    console.log("After setting up credentials, run this command again to verify.");
    return false;
  }
}

/**
 * Make authenticated request to Vertex AI API
 */
async function makeVertexAIRequest(
  config: VertexAIConfig,
  endpoint: string,
  body: unknown,
): Promise<Response> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("No authentication token available. Run 'check-auth' for setup instructions.");
  }

  const url = `https://${config.location}-${config.apiEndpoint}/v1/projects/${config.project}/locations/${config.location}/${endpoint}`;

  console.log(`Calling Vertex AI API: ${endpoint}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return response;
}

/**
 * Generate a video using Veo 3.1 model
 */
async function generateVideo(options: {
  prompt: string;
  project: string;
  location: string;
  duration?: string;
  style?: string;
  aspectRatio?: string;
}): Promise<void> {
  console.log("Generating video with Veo 3.1...\n");
  console.log(`Prompt: ${options.prompt}`);
  console.log(`Project: ${options.project}`);
  console.log(`Location: ${options.location}`);
  if (options.duration) console.log(`Duration: ${options.duration}`);
  if (options.style) console.log(`Style: ${options.style}`);
  if (options.aspectRatio) console.log(`Aspect Ratio: ${options.aspectRatio}`);
  console.log();

  const config: VertexAIConfig = {
    project: options.project,
    location: options.location,
    apiEndpoint: "aiplatform.googleapis.com",
  };

  const requestBody = {
    instances: [{
      prompt: options.prompt,
      ...(options.duration && { duration: options.duration }),
      ...(options.style && { style: options.style }),
      ...(options.aspectRatio && { aspectRatio: options.aspectRatio }),
    }],
    parameters: {
      model: MODEL_VEO_3_1,
    },
  };

  try {
    const response = await makeVertexAIRequest(
      config,
      `publishers/google/models/${MODEL_VEO_3_1}:predict`,
      requestBody,
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error (${response.status}): ${errorText}`);
      
      if (response.status === 403) {
        console.log("\nTroubleshooting:");
        console.log("1. Ensure Vertex AI API is enabled in your project");
        console.log("2. Check that you have the necessary permissions");
        console.log("3. Verify your project ID is correct");
      }
      
      Deno.exit(1);
    }

    const result = await response.json();
    console.log("\n✓ Video generation request submitted successfully!");
    console.log("\nResponse:");
    console.log(JSON.stringify(result, null, 2));
    
    if (result.predictions && result.predictions[0]) {
      const prediction = result.predictions[0] as VideoPrediction;
      if (prediction.videoUri) {
        console.log(`\n✓ Video URL: ${prediction.videoUri}`);
      }
      if (prediction.jobId) {
        console.log(`\n✓ Job ID: ${prediction.jobId}`);
        console.log("   (Video generation may take several minutes. Check status with this job ID)");
      }
    }
  } catch (error) {
    console.error("\nError generating video:");
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    Deno.exit(1);
  }
}

/**
 * Generate an image using Imagen model
 */
async function generateImage(options: {
  prompt: string;
  project: string;
  location: string;
  style?: string;
  resolution?: string;
  numImages?: number;
}): Promise<void> {
  console.log("Generating image with Imagen...\n");
  console.log(`Prompt: ${options.prompt}`);
  console.log(`Project: ${options.project}`);
  console.log(`Location: ${options.location}`);
  if (options.style) console.log(`Style: ${options.style}`);
  if (options.resolution) console.log(`Resolution: ${options.resolution}`);
  if (options.numImages) console.log(`Number of images: ${options.numImages}`);
  console.log();

  const config: VertexAIConfig = {
    project: options.project,
    location: options.location,
    apiEndpoint: "aiplatform.googleapis.com",
  };

  const requestBody = {
    instances: [{
      prompt: options.prompt,
      ...(options.style && { style: options.style }),
      ...(options.resolution && { resolution: options.resolution }),
    }],
    parameters: {
      sampleCount: options.numImages || 1,
    },
  };

  try {
    const response = await makeVertexAIRequest(
      config,
      `publishers/google/models/${MODEL_IMAGEN}:predict`,
      requestBody,
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error (${response.status}): ${errorText}`);
      
      if (response.status === 403) {
        console.log("\nTroubleshooting:");
        console.log("1. Ensure Vertex AI API is enabled in your project");
        console.log("2. Check that you have the necessary permissions");
        console.log("3. Verify your project ID is correct");
      }
      
      Deno.exit(1);
    }

    const result = await response.json();
    console.log("\n✓ Image generation completed successfully!");
    console.log("\nResponse:");
    console.log(JSON.stringify(result, null, 2));
    
    if (result.predictions) {
      console.log(`\n✓ Generated ${result.predictions.length} image(s)`);
      result.predictions.forEach((pred: ImagePrediction, i: number) => {
        if (pred.bytesBase64Encoded) {
          console.log(`   Image ${i + 1}: Base64 data available (length: ${pred.bytesBase64Encoded.length})`);
        }
        if (pred.imageUri) {
          console.log(`   Image ${i + 1}: ${pred.imageUri}`);
        }
      });
    }
  } catch (error) {
    console.error("\nError generating image:");
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    Deno.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArgs(Deno.args, {
    boolean: ["help"],
    string: ["prompt", "project", "location", "duration", "style", "aspect-ratio", "resolution", "num-images"],
    alias: {
      h: "help",
      p: "prompt",
      l: "location",
      d: "duration",
      s: "style",
      a: "aspect-ratio",
      r: "resolution",
      n: "num-images",
    },
    default: {
      location: "us-central1",
      "num-images": "1",
    },
  });

  if (args.help || args._.length === 0) {
    console.log(HELP_MESSAGE);
    Deno.exit(0);
  }

  const command = args._[0]?.toString();

  switch (command) {
    case "check-auth": {
      const isAuthenticated = await checkAuth();
      Deno.exit(isAuthenticated ? 0 : 1);
      break;
    }

    case "generate-video": {
      if (!args.prompt) {
        console.error("Error: --prompt is required for video generation");
        console.log("\nUse --help for usage information");
        Deno.exit(1);
      }
      if (!args.project) {
        console.error("Error: --project is required");
        console.log("\nUse --help for usage information");
        Deno.exit(1);
      }

      await generateVideo({
        prompt: args.prompt,
        project: args.project,
        location: args.location,
        duration: args.duration,
        style: args.style,
        aspectRatio: args["aspect-ratio"],
      });
      break;
    }

    case "generate-image": {
      if (!args.prompt) {
        console.error("Error: --prompt is required for image generation");
        console.log("\nUse --help for usage information");
        Deno.exit(1);
      }
      if (!args.project) {
        console.error("Error: --project is required");
        console.log("\nUse --help for usage information");
        Deno.exit(1);
      }

      const numImages = parseInt(args["num-images"], 10);
      
      // Validate num-images parameter
      if (isNaN(numImages)) {
        console.error("Error: --num-images must be a valid number");
        Deno.exit(1);
      }
      
      if (!Number.isInteger(parseFloat(args["num-images"]))) {
        console.error("Error: --num-images must be an integer (no decimals)");
        Deno.exit(1);
      }
      
      if (numImages < 1) {
        console.error("Error: --num-images must be at least 1");
        Deno.exit(1);
      }
      
      if (numImages > MAX_NUM_IMAGES) {
        console.error(`Error: --num-images cannot exceed ${MAX_NUM_IMAGES}`);
        console.error("(To generate more images, make multiple requests)");
        Deno.exit(1);
      }

      await generateImage({
        prompt: args.prompt,
        project: args.project,
        location: args.location,
        style: args.style,
        resolution: args.resolution,
        numImages: numImages,
      });
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.log("\nAvailable commands: generate-video, generate-image, check-auth");
      console.log("Use --help for more information");
      Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
