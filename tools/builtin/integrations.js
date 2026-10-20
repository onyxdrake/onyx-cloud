module.exports = {
  name: 'integrasi',
  description: 'Sambungin ke layanan eksternal (Spotify, Kalender, Gmail, dll).',
  params: { layanan: 'string', aksi: 'string', data: 'object' },
  run: async ({ layanan, aksi, data }) => {
    // Placeholder: nanti bisa diintegrasiin ke API masing-masing
    const supported = ['spotify', 'calendar', 'gmail', 'github', 'notion', 'slack'];
    if (!supported.includes(layanan)) {
      return `Layanan "${layanan}" belum didukung. Yang tersedia: ${supported.join(', ')}`;
    }
    return `[Integrasi ${layanan}] Aksi: ${aksi}. Data: ${JSON.stringify(data)}. (Butuh API key user)`;
  }
};
