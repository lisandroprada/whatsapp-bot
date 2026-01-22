import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { BrainService } from './brain.service';
import { ApiKeyGuard } from '../whatsapp/guards/api-key.guard';

@Controller('brain')
@UseGuards(ApiKeyGuard)
export class BrainController {
  constructor(private readonly brainService: BrainService) {}

  @Get('prompt')
  async getPrompt() {
    const prompt = await this.brainService.getStoredSystemPrompt();
    return { prompt };
  }

  @Put('prompt')
  async updatePrompt(@Body() body: { prompt: string; updatedBy?: string }) {
    const result = await this.brainService.updateSystemPrompt(body.prompt, body.updatedBy);
    return { success: true, config: result };
  }

  @Post('prompt/review')
  async reviewPrompt(@Body() body: { prompt: string }) {
    const review = await this.brainService.reviewPrompt(body.prompt);
    return { review };
  }
}
