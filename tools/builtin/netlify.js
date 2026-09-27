module.exports = {
  name: 'netlify_deploy',
  description: 'Deploy file/situs ke Netlify. Butuh NETLIFY_TOKEN.',
  params: { nama: 'string', konten: 'string' },
  run: async ({ nama, konten }) => {
    const token = process.env.NETLIFY_TOKEN;
    if (!token) return 'Error: NETLIFY_TOKEN belum di-set di .env';
    try {
      const res = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: nama })
      });
      const data = await res.json();
      if (data.error) return 'Netlify error: ' + data.error;
      return `Situs dibuat: ${data.url || data.ssl_url}`;
    } catch (e) {
      return 'Error: ' + e.message;
    }
  }
};
