module.exports = {
  name: 'fetch',
  description: 'Ambil isi halaman web dari URL.',
  params: { url: 'string' },
  run: async ({ url }) => {
    const res = await fetch(url);
    return (await res.text()).slice(0, 2000);
  }
};
