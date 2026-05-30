async function sendChatMessage(message) {
  const res = await apiCall('POST', '/chat/message', { message });
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}
