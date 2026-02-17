export interface GenerateAIResponseInput {
  patientId: number;
  patientName: string;
  medicalNotes: string;
  message: string;
}

export interface GenerateAIResponseOutput {
  message: string;
  provider: string;
}

export interface AIProvider {
  generateResponse(input: GenerateAIResponseInput): Promise<GenerateAIResponseOutput>;
}
