import http from 'http';

const PREFIX_FROM = 'http://localhost:3000';
const PREFIX_TO = 'http://localhost:4000';

const server = http.createServer((req, res) => {
  let url = req.url;

  if (url.startsWith(PREFIX_FROM)) {
    url = PREFIX_TO + url.slice(PREFIX_FROM.length);
    console.log(`Redirecting to ${url}`);

    const options = {
      method: req.method,
      headers: req.headers,
    };

    const proxyReq = http.request(url, options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    req.pipe(proxyReq, { end: true });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
