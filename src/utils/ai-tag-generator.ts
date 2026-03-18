import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';

export class AITagGenerator {
  private static aiModel: ChatGoogleGenerativeAI;

  static initialize(apiKey: string) {
    this.aiModel = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash-exp',
      apiKey,
    });
  }

  static async generateTags(file: Express.Multer.File): Promise<string[]> {
    try {
      const mimeType = file.mimetype;

      if (mimeType.startsWith('image/')) {
        const base64Image = file.buffer.toString('base64');

        const message = new HumanMessage({
          content: [
            {
              type: 'text',
              text: 'Analyze this image and provide 3-5 English tags. Only return tags separated by commas. Example: cat, home, play',
            },
            {
              type: 'image_url',
              image_url: `data:${mimeType};base64,${base64Image}`,
            },
          ],
        });

        const response = await this.aiModel.invoke([message]);
        const tags = response.content
          .toString()
          .split(',')
          .map((tag) => tag.trim());

        return tags.length > 0 ? tags : ['image', 'photo'];
      }

      if (mimeType === 'application/pdf') {
        return ['pdf', 'document'];
      }

      if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') {
        return ['word', 'document', 'text'];
      }

      if (mimeType.includes('presentationml')) {
        return ['powerpoint', 'presentation', 'slides'];
      }

      if (mimeType.includes('spreadsheetml')) {
        return ['excel', 'spreadsheet', 'data'];
      }

      if (mimeType.startsWith('video/')) {
        return ['video', 'media'];
      }

      if (mimeType.startsWith('audio/')) {
        return ['audio', 'media'];
      }

      return ['document', 'file'];
    } catch (error) {
      console.error('AI tag error:', error);
      return ['document', 'file'];
    }
  }
}