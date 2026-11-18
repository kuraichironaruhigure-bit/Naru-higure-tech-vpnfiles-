
async function downloadFile(id) {
  const buttons = document.querySelectorAll("[data-download]");
  const button = [...buttons].find(b => b.dataset.download === id);

  if (button) {
    button.disabled = true;
    button.textContent = "Preparing...";
  }

  try {
    const { data: file, error } = await sb
      .from("vpn_submissions")
      .select("storage_path,file_name")
      .eq("id", id)
      .eq("status", "approved")
      .single();

    if (error || !file) {
      throw new Error(error?.message || "File is unavailable.");
    }

    const { data, error: signError } = await sb.storage
      .from("vpn-files")
      .createSignedUrl(file.storage_path, 300);

    if (signError || !data?.signedUrl) {
      throw new Error(signError?.message || "Could not create download link.");
    }

    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.download = file.file_name || "download";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();

    const { data: userData } = await sb.auth.getUser();

    if (userData?.user) {
      await sb.rpc("record_file_download", { file_id: id });
    }

    say("accountStatus", "Download started!");
    await loadFiles();

  } catch (error) {
    alert("Download failed: " + error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Download";
    }
  }
}
