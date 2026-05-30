async function fetchFiles(workspaceId, page = 1, limit = 20) {
  const res = await apiCall('GET', `/files/workspaces/${workspaceId}/files?page=${page}&limit=${limit}`);
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}

async function fetchFileDownloadUrl(fileId) {
  const res = await apiCall('GET', `/files/${fileId}/url`);
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}

async function fetchFileDirectDownloadUrl(fileId) {
  const res = await apiCall('GET', `/files/${fileId}/download`);
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}

async function fetchFileShareUrl(fileId, expirySeconds) {
  const res = await apiCall('GET', `/files/${fileId}/share?expiry=${expirySeconds}`);
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}

async function renameFile(fileId, filename) {
  const res = await apiCall('PUT', `/files/${fileId}`, { filename });
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}

async function deleteFiles(fileIds) {
  const res = await apiCall('DELETE', '/files/bulk-delete', {
    file_ids: fileIds.map(Number),
  });
  if (!res?.ok) throw new Error(await extractError(res));
  return res.json();
}

function uploadFilesXhr(workspaceId, files, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    [...files].forEach(f => formData.append('files', f));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/files/workspaces/${workspaceId}/files`);
    xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);

    if (onProgress) {
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status === 401) { logout(); reject(new Error('Unauthorized')); return; }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText || '{}'));
      } else {
        let msg = 'Upload failed.';
        try { msg = JSON.parse(xhr.responseText)?.message || msg; } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(formData);
  });
}
