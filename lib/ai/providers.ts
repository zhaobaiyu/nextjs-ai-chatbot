import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

const AWS_REGION = process.env.AWS_REGION!;
const AWS_ROLE_ARN = process.env.AWS_ROLE_ARN!;

const bedrock = createAmazonBedrock({
  region: AWS_REGION,
  credentialProvider: awsCredentialsProvider({
    roleArn: AWS_ROLE_ARN,
  }),
});

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "chat-model": bedrock("us.anthropic.claude-sonnet-4-5-20250929-v1:0"),
        "chat-model-reasoning": wrapLanguageModel({
          model: bedrock("us.anthropic.claude-sonnet-4-5-20250929-v1:0"),
          middleware: extractReasoningMiddleware({ tagName: "thinking" }),
        }),
        "title-model": bedrock("us.anthropic.claude-sonnet-4-5-20250929-v1:0"),
        "artifact-model": bedrock("us.anthropic.claude-sonnet-4-5-20250929-v1:0"),
      },
    });
