import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import app from '@/config/firebase';

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export interface AIResponse {
  text: string;
  error?: string;
}

class AIService {
  private model: any;
  private isInitialized = false;

  constructor() {
    this.initializeAI();
  }

  private async initializeAI() {
    try {
      // Use the existing Firebase app instance
      const ai = getAI(app, { backend: new GoogleAIBackend() });
      
      // Create a GenerativeModel instance
      this.model = getGenerativeModel(ai, { model: "gemini-2.5-flash" });
      
      this.isInitialized = true;
      console.log(' AI Service initialized successfully with Gemini API');
    } catch (error) {
      console.error(' Failed to initialize AI service:', error);
      this.isInitialized = false;
    }
  }

  async sendMessage(userMessage: string): Promise<AIResponse> {
    if (!this.isInitialized || !this.model) {
      return {
        text: 'AI service is not available. Please try again later.',
        error: 'AI service not initialized'
      };
    }

    try {
      // Create a health-focused prompt with formatting instructions
      const prompt = `You are a helpful health assistant for patients using a medical app. 
      Please provide general health information, wellness tips, and answer common health questions. 
      Always remind users to consult with their healthcare provider for medical advice, diagnosis, or treatment.
      
      IMPORTANT: Format your response as plain text only. Do not use:
      - Markdown formatting (**, *, #, etc.)
      - Special characters or symbols
      - Bullet points or numbered lists
      - Code blocks or backticks
      - Any formatting that would not display well in a simple text message
      
      Write in a conversational, friendly tone as if speaking directly to the patient.
      
      User question: ${userMessage}`;

      // Generate text output
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Clean up the response text
      const cleanedText = this.cleanResponseText(text || 'I apologize, but I couldn\'t generate a response. Please try again.');

      return {
        text: cleanedText
      };
    } catch (error) {
      console.error(' Error sending message to AI:', error);
      return {
        text: 'I apologize, but I\'m having trouble processing your request right now. Please try again later.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async sendStreamingMessage(userMessage: string, onChunk: (chunk: string) => void): Promise<void> {
    if (!this.isInitialized || !this.model) {
      onChunk('AI service is not available. Please try again later.');
      return;
    }

    try {
      const prompt = `You are a helpful health assistant for patients using a medical app. 
      Please provide general health information, wellness tips, and answer common health questions. 
      Always remind users to consult with their healthcare provider for medical advice, diagnosis, or treatment.
      
      IMPORTANT: Format your response as plain text only. Do not use:
      - Markdown formatting (**, *, #, etc.)
      - Special characters or symbols
      - Bullet points or numbered lists
      - Code blocks or backticks
      - Any formatting that would not display well in a simple text message
      
      Write in a conversational, friendly tone as if speaking directly to the patient.
      
      User question: ${userMessage}`;

      const result = await this.model.generateContentStream(prompt);
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          // Clean each chunk as it comes in
          const cleanedChunk = this.cleanResponseText(chunkText);
          onChunk(cleanedChunk);
        }
      }
    } catch (error) {
      console.error(' Error sending streaming message to AI:', error);
      onChunk('I apologize, but I\'m having trouble processing your request right now. Please try again later.');
    }
  }

  private cleanResponseText(text: string): string {
    if (!text) return text;

    return text
      // Remove markdown formatting
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold **text** -> text
      .replace(/\*(.*?)\*/g, '$1') // Italic *text* -> text
      .replace(/#{1,6}\s*/g, '') // Headers # ## ### -> empty
      .replace(/`(.*?)`/g, '$1') // Code `text` -> text
      .replace(/```[\s\S]*?```/g, '') // Code blocks
      
      // Remove special characters and symbols
      .replace(/[•·▪▫‣⁃]/g, '-') // Various bullet points -> dash
      .replace(/[→➜➤]/g, '->') // Arrows -> text arrows
      .replace(/[✓✔]/g, 'Yes') // Checkmarks -> Yes
      .replace(/[✗✘]/g, 'No') // X marks -> No
      .replace(/[⚠]/g, 'Warning:') // Warning symbols
      .replace(/[ℹ️ℹ]/g, 'Info:') // Info symbols
      
      // Clean up spacing and formatting
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Multiple newlines -> double newline
      .replace(/^\s*[-•]\s*/gm, '• ') // Standardize bullet points
      .replace(/^\s*\d+\.\s*/gm, '') // Remove numbered lists
      .replace(/\s+/g, ' ') // Multiple spaces -> single space
      .replace(/\n\s+/g, '\n') // Remove leading spaces from lines
      
      // Clean up common formatting issues
      .replace(/\*\s+/g, '') // Remove asterisks with spaces
      .replace(/\s+\*/g, '') // Remove spaces with asterisks
      .replace(/^\s*[-=]+\s*$/gm, '') // Remove separator lines
      .replace(/^\s*[#*]+\s*$/gm, '') // Remove empty markdown lines
      
      // Final cleanup
      .trim()
      .replace(/\n{3,}/g, '\n\n'); // Multiple newlines -> double newline
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const aiService = new AIService();
