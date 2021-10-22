var X_CSRF_TOKEN = "INSERT YOUR CSRF TOKEN HERE";
var X_DROPBOX_PATH_ROOT = "INSERT PATH ROOT";
var X_DROPBOX_UID = "INSERT YOUR UID";
var CONCURRENT_SHARES = 5 // speed multiplier, you can bump it until you start getting error 429 - means that Dropbox is throttling you
var SPLIT_PLOT_PATH = [
	"/path/to/plot/folder/don't/remove/leading/slash",
	"/path/to/plot/folder2/don't/remove/leading/slash",
	"/path/to/plot/folder3/don't/remove/leading/slash",
	// add more here
];


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
				reject();
			}
		});
	});
}

function download(filename, text) {
	let element = document.createElement("a");
	element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
	element.setAttribute("download", filename);
  
	element.style.display = "none";
	document.body.appendChild(element);
  
	element.click();
  
	document.body.removeChild(element);
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
	for (const folder of SPLIT_PLOT_PATH){
		let awaitedRequests = 0;

		let fileList = [];
		let calls = [];

		let body = await getFileList(folder);
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


		let results = [];
		let bytes = 0;

		console.log(`Sharing ${fileList.length} files`);

		for (let i = 0; i < fileList.length; i++){
			
			const file = fileList[i];

			const filename = file.fq_path.split("/").pop();

			let index;
			try {
				const numberString = filename.split("_")[0];
				index = Number(numberString) - 1;
			} catch (error){
				index = i;
			}
			
			if (Number.isNaN(index)){
				index = i;
			}
			
			const ID = file.file_id;
			bytes = Math.max(bytes, file.size_bytes);

			
			async function scopedShare(){
				let retries = 0;
				awaitedRequests++;

				while (true){
					try {
						const result = await shareByID(ID);
						results[index] = result;
						break;
					} catch (error){
						console.log("Got an error while sharing, retrying in 5 seconds...");
						if (retries === 7){
							console.error("The same request failed for the 8th time, aborting.");
							return;
						} else {
							await sleep(5000);
						}
					}

					retries++;
				}

				awaitedRequests--;
			}


			calls.push(scopedShare);
		}

		console.log(`Determined part size to be ${bytes}`);

		for (const call of calls){
			while (awaitedRequests === CONCURRENT_SHARES){
				await sleep(50);
			}

			call();
		}

		while (awaitedRequests > 0){
			await sleep(50);
		}

		console.log("SUCCESS! Here's your auto-generated --remoteplot-- file, if the size on the second line doesn't match, replace it manually.");
		
		const remotePlot = "dropbox\n" + bytes + "\n" +  results.join("\n")
		let finalFilename = "--remoteplot--";
		let filenameTemp = (fileList[0].fq_path.split("/").pop()).split("_");
		filenameTemp.shift();
		finalFilename += filenameTemp.join("_");

		download(finalFilename, remotePlot);
	}
})();
