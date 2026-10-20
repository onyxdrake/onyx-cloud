module.exports = {
  name: 'image',
  description: 'Generate gambar lewat Pollinations.',
  params: { prompt: 'string' },
  run: async ({ prompt }) => {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`;
    return `Gambar: ${url}`;
  }
};
