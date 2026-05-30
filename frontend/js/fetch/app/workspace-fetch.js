async function fetchWorkspaces() {
  const res = await apiCall('GET', '/workspaces');
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}

async function fetchWorkspace(id) {
  const res = await apiCall('GET', `/workspaces/${id}`);
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}

async function createWorkspace(data) {
  const res = await apiCall('POST', '/workspaces', data);
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}

async function updateWorkspace(id, data) {
  const res = await apiCall('PUT', `/workspaces/${id}`, data);
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}

async function deleteWorkspace(id) {
  const res = await apiCall('DELETE', `/workspaces/${id}`);
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}
