var X_CSRF_TOKEN = "INSERT YOUR CSRF TOKEN HERE";
var X_DROPBOX_PATH_ROOT = "INSERT PATH ROOT";
var X_DROPBOX_UID = "INSERT YOUR UID";
var SPLIT_PLOT_PATH = "/path/to/plot/folder/don't/remove/leading/slash";

function sleep(ms){
	return new Promise((resolve, reject) => {
		setTimeout(resolve, ms);
	});
}

function shareByID(fileID, index){
	return new Promise(async (resolve, reject) => {
		fetch("https://www.dropbox.com/2/sharing/create_shared_link_with_settings", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-csrf-token": X_CSRF_TOKEN,
				"x-dropbox-path-root": X_DROPBOX_PATH_ROOT,
				"x-dropbox-uid": X_DROPBOX_UID
			},
			body: JSON.stringify({
				path: fileID,
				settings: {
					access: "max"
				}
			})
		})
		.then(async (res) => {
			if (res.status === 200){
				const body = await res.json();
				const result = body.url.replace("www.dropbox", "dl.dropboxusercontent").replace("?dl=0", "");
				console.log(`Successfully shared file ${fileID}`)
				resolve(result);
			} else if (res.status === 409){
				const body = await res.json();
				const result = body.error.shared_link_already_exists.metadata.url.replace("www.dropbox", "dl.dropboxusercontent").replace("?dl=0", "");
				console.log(`Successfully shared file ${fileID}`);
				resolve(result);
			} else {
				console.error("We errored out, aborting.");
				for (const timeout of timeouts){
					clearTimeout(timeout);
				}
				reject();
			}
		});
	});
}

function getFileList(path){
	return new Promise(async (resolve, reject) => {
		fetch("https://www.dropbox.com/2/files/browse", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-csrf-token": X_CSRF_TOKEN,
				"x-dropbox-path-root": X_DROPBOX_PATH_ROOT,
				"x-dropbox-uid": X_DROPBOX_UID
			},
			body: JSON.stringify({
				fq_path: path,
				include_deleted: false,
				sort_type: {
					".tag": "files_by_name"
				},
				sort_is_ascending: true,
				sort_folders_first: true,
				include_xattrs: false,
				include_folder_overview: false
			})
		})
		.then(async (res) => {
			if (res.status === 200){
				const body = await res.json();
				resolve(body);
			} else {
				reject();
			}
		});
	});
}

function getFileListContinue(cursor){
	return new Promise(async (resolve, reject) => {
		fetch("https://www.dropbox.com/2/files/browse_continue", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-csrf-token": X_CSRF_TOKEN,
				"x-dropbox-path-root": X_DROPBOX_PATH_ROOT,
				"x-dropbox-uid": X_DROPBOX_UID
			},
			body: JSON.stringify({
				cursor: cursor
			})
		})
		.then(async (res) => {
			if (res.status === 200){
				const body = await res.json();
				resolve(body);
			} else {
				console.error("We errored out, aborting.");
				reject();
			}
		});
	});
}

(async function executeShare(){
	let fileList = [];
	
	let body = await getFileList(SPLIT_PLOT_PATH);
	for (const file of body.paginated_file_info){
		fileList.push(file.file_info);
		console.log(`Noticing file ${file.file_info.fq_path} with file_id ${file.file_info.file_id}`);
	}

	while (body.has_more){
		body = await getFileListContinue(body.next_request_voucher);
		for (const file of body.paginated_file_info){
			fileList.push(file.file_info);
			console.log(`Noticing file ${file.file_info.fq_path} with file_id ${file.file_info.file_id}`);
		}
	}



	let promises = [];
	let results = [];

	let bytes = 0;


	for (let i = 0; i < fileList.length; i++){
		const file = fileList[i];

		const filename = file.fq_path.split("/").pop();

		try {
			const numberString = filename.split("_")[0];
			var index = Number(numberString) - 1;
		} catch (error){
			index = i;
		}
		
		if (Number.isNaN(index)){
			index = i;
		}
		
		const ID = file.file_id;
		bytes = Math.max(bytes, file.size_bytes);

		let retries = 0;

		while (true){
			try {
				const result = await shareByID(ID);
				results[index] = result;
				break;
			} catch (error){
				console.log("Got an error while sharing, retrying in 5 seconds...");
				if (retries === 4){
					console.error("The same request failed for the 5th time, aborting.");
				} else {
					await sleep(5000);
				}
			}

			retries++;
		}
	}

	console.log(`Determined part size to be ${bytes}`);
	console.log(`Sharing ${fileList.length} files`);

	Promise.all(promises)
	.then(() => {
		console.log("SUCCESS! Here's your auto-generated --remoteplot-- file, if the size on the second line doesn't match, replace it manually.");
		console.log("dropbox\n" + bytes + "\n" +  results.join("\n"));
	});
})();