import { storeMedia, getLocalUpload, MAX_MEDIA_BYTES } from '../lib/storage';
import { POST as uploadPost } from '../app/api/upload/route';
import { GET as uploadGet } from '../app/api/upload/[name]/route';

async function run() {
  console.log('Testing lib/storage directly:');
  const imgBuf = Buffer.from('fake-image-bytes');
  const storedImg = await storeMedia(imgBuf, 'image/png', 'test.png');
  console.log('  storedImg:', storedImg);
  if (!storedImg.url.startsWith('/api/upload/') || storedImg.kind !== 'image') {
    throw new Error('Failed image store');
  }

  const name = storedImg.url.replace('/api/upload/', '');
  const fetched = await getLocalUpload(name);
  if (!fetched || fetched.mimeType !== 'image/png') {
    throw new Error('Failed image fetch');
  }
  console.log('  fetchedImg mime:', fetched.mimeType, 'size:', fetched.size);

  const audioBuf = Buffer.from('fake-audio-bytes');
  const storedAudio = await storeMedia(audioBuf, 'audio/webm', 'test.webm');
  console.log('  storedAudio:', storedAudio);
  if (storedAudio.kind !== 'audio') throw new Error('Failed audio store');

  try {
    await storeMedia(Buffer.alloc(MAX_MEDIA_BYTES + 10), 'image/jpeg');
    throw new Error('Should fail on size');
  } catch (e: unknown) {
    console.log("  Successfully rejected oversize file:", (e as Error).message);
  }

  try {
    await storeMedia(Buffer.from('hello'), 'text/plain');
    throw new Error('Should fail on mime');
  } catch (e: unknown) {
    console.log("  Successfully rejected bad mime:", (e as Error).message);
  }

  console.log('\nTesting Route Handlers over simulated Request:');
  // Test POST /api/upload
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const formData = new FormData();
  formData.append('file', new Blob([Buffer.from('my-test-photo')], { type: 'image/webp' }), 'photo.webp');

  const postReq = new Request('http://localhost:3000/api/upload', {
    method: 'POST',
    body: formData,
  });

  const postRes = await uploadPost(postReq);
  const postBody = await postRes.json();
  console.log('  POST /api/upload response:', postRes.status, postBody);
  if (postRes.status !== 200 || !postBody.ok || !postBody.data.url) {
    throw new Error('POST /api/upload handler failed');
  }

  // Test GET /api/upload/[name]
  const uploadName = postBody.data.url.replace('/api/upload/', '');
  const getReq = new Request(`http://localhost:3000/api/upload/${uploadName}`);
  const getRes = await uploadGet(getReq, { params: Promise.resolve({ name: uploadName }) });
  console.log('  GET /api/upload/[name] status:', getRes.status, 'contentType:', getRes.headers.get('content-type'));
  if (getRes.status !== 200 || getRes.headers.get('content-type') !== 'image/webp') {
    throw new Error('GET /api/upload/[name] handler failed');
  }

  console.log('\nALL UPLOAD TESTS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
