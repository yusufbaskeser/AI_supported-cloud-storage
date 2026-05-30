async function fetchUser(userId) {
  const res = await apiCall('GET', `/users/${userId}`);
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}

async function updateUser(userId, data) {
  const res = await apiCall('PUT', `/users/${userId}`, data);
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}

async function deleteUser(userId) {
  const res = await apiCall('DELETE', `/users/${userId}`);
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}
