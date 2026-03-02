import anthropic from './anthropic.svg';
import openai from './openai.svg';
import google from './google.svg';
import openrouter from './openrouter.svg';
import moonshot from './moonshot.svg';
import siliconflow from './siliconflow.svg';
import ollama from './ollama.svg';
import aihub from './aihub.svg';
import custom from './custom.svg';

export const providerIcons: Record<string, string> = {
    openai,
    google,
    openrouter,
    moonshot,
    siliconflow,
    ollama,
    aihub,
    'aihub-dev': aihub,
    'aihub-prd': aihub,
    custom,
};
