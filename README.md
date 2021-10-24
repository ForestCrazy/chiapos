# chia-blockchain remote farming (INDEV)

This client fork (no changes to the protocol, runs on Chia mainnet) allows a farmer to store their plots in a remote location accessible via HTTP(S).  
Intended use case is when one has a (preferably) free, unused cloud storage subscription and wants to use it to farm some XCH instead of leaving it empty.  
You will also need the modded Python client: [Chia Blockchain](https://github.com/GLise710/chia-blockchain)  

Remote plots work in different modes - so far range and onedrive mode. The mode is specified in the plot (--remoteplot--) file.  

## Bandwidth requirements / plot count limitations
Latency and stability is the key part, 800 ms maximum to work reliably, under 500 ms is recommended. A fast connection gets around 250 to 300 ms latency to OneDrive. Bandwidth is recommended at least 10 Mbit/s download and 4 Mbit/s upload.
Plot count is not limited by this program. Thanks to plot filter and pool difficulty scaling, your disk/cloud I/O remains about the same for any amount of plots.

## --remoteplot-- file description
These are regular files on your hard drive, in your plots directory. They have the .plot extension, but their filename contains "--remoteplot--" in it. Put it in the beginning of the filename and it will work. Remote plots will add up to plot count, but not total size in logs/GUI (they will, but only with the on-disk size of the --remoteplot-- file).  
Contents of these files are specified by their mode. The first line always specifies that mode, upcoming lines specify mode-specific settings.

# Cookie credentials
You specify a path to a file which contains your credentials (if needed, for OneDrive in case your organisation restricts sharing outside, for Dropbox not needed, for Range depends) using the CHIA_REMOTE_COOKIES_PATH environment variable. If it doesn't exist, no cookie credentials are used. Upon modifying that file, new cookie credentials will be updated and used in under 2 minutes.  
Important #1: DO NOT enter newline character at the end of this file, it has to be all a single line.  
Important #2: It has to start with ```cookie: ```, an example would be ```cookie: logged=true; session=qwertzuiopasdfghjklyxcvbnm0123456789```  

# Modes

## Range mode:
range  
direct URL  

This is the simplest mode. It uses Range headers in HTTP requests to ask the server for a specific portion of the file, as if we were seeking and reading the file regularly.
It will work on fast clouds, or when you store the files in one piece on your own server. Most clouds (so far confirmed OneDrive and Dropbox) will scatter your files over data centers all around the world. This will cause your request latency to skyrocket, as the servers are searching for the part you need in the network. The latency will be so bad, that one proof will take around 100 to 140 seconds to be created. You optimally want to go below 5 seconds (you won't except on your own servers, but OneDrive mode on OneDrive reaches speeds of 6-10 seconds), under 17 seconds is acceptable, under 30 seconds you will be losing a more significant amount of partial proofs and on-chain proofs too. For longer times you're losing 100% of proofs to slowness.  
Configuration only needs the direct URL to that file on the server.

## OneDrive mode (works with SharePoint too):
onedrive  
split file size (positive integer)  
files per URL (positive integer)  
URL list (newline separated, supports LF and CRLF line breaks)  

The issue with OneDrive is described in range mode above, this means that we need to split the big plot to smaller pieces in order to read from smaller files, which is fast. Before uploading, you will have to use a file splitter. GSplit3 is one of them, but there are many others and it is a matter of a few lines of code to write your own. In remote-utilities folder in this repository is a Python file splitter. The parts need to be of the same size, 16 MB is fine. Please note that if you try to sync to a weak computer (probably in school, work, etc.) with 60000 files on that OneDrive, it will cause the computer to LAG, in this case, with a slightly higher but still acceptable latencies you can split to 256 MB parts (around 100 ms per request more compared to 16 MB). It will effectively thwart that sync lag. The parts also cannot have any data added to them by the splitter. So make sure to set your splitter to not add any tags, headers or modify the data in any way. Then you need to upload the files.  
In the end, you will access your parts by their name (get the URL for 1 file by downloading it, copy it), replace the file number in the file name with '{BLOCK}', without quotes. This will make the harvester replace the {BLOCK} keyword with the part number it needs. Parts are counted from 1, not 0, cause it was originally made to work with GSplit3 as splitter.

### Legacy multi-folder talk
If you don't want to give your harvester access to your OneDrive account, you will have to share the files in order to access them (some organizations actually block public sharing, so access would be mandatory in such case). OneDrive has a limitation which allows one to share only 50000 files in one folder and all its subfolders. A k32 plot will split to around 220000 parts (WARNING, don't split to 491520 bytes big parts anymore, new code lets you use arbitrary size without any penalty for slow connections, 16 MB parts are the new recommended), so this means that you need to put the files into folders of max file count 50000. You should go for the maximum amount so that you end up with the least amount of folders. These folders also have to be in your root folder, otherwise the subfolder part of the sharing limitation kicks in. You will fill up your folders to the amount specified in "files per URL" and then put whatever remains into the last one. Use as of 8. October 2021 and later would be if you're filling leftover space from multiple accounts with a single plot, you can split the plot between such accounts and specify URLs.

### Example OneDrive configuration (now, you should only need one URL)
```
onedrive
491520
50000
https://chiacrypto-my.sharepoint.com/personal/jack_the_farmer_chia_crypto/_layouts/15/download.aspx?SourceUrl=%2Fpersonal%2Fjack%5Fchia%5Fcrypto%2FDocuments%2Ffolder0%5Fchia%5F00mes8r9f5p4ok86%2F{BLOCK}%5Fplot%2Dk32%2D2021%2D08%2D05%2D17%2D49%2Dc51562c946522a44b09a3678d8d084a3a3c35d0d4184cd209fa72a305b9dbd58%2Eplot
https://chiacrypto-my.sharepoint.com/personal/jack_the_farmer_chia_crypto/_layouts/15/download.aspx?SourceUrl=%2Fpersonal%2Fjack%5Fchia%5Fcrypto%2FDocuments%2Ffolder1%5Fchia%5F00mes8r9f5p4ok86%2F{BLOCK}%5Fplot%2Dk32%2D2021%2D08%2D05%2D17%2D49%2Dc51562c946522a44b09a3678d8d084a3a3c35d0d4184cd209fa72a305b9dbd58%2Eplot
https://chiacrypto-my.sharepoint.com/personal/jack_the_farmer_chia_crypto/_layouts/15/download.aspx?SourceUrl=%2Fpersonal%2Fjack%5Fchia%5Fcrypto%2FDocuments%2Ffolder2%5Fchia%5F00mes8r9f5p4ok86%2F{BLOCK}%5Fplot%2Dk32%2D2021%2D08%2D05%2D17%2D49%2Dc51562c946522a44b09a3678d8d084a3a3c35d0d4184cd209fa72a305b9dbd58%2Eplot
https://chiacrypto-my.sharepoint.com/personal/jack_the_farmer_chia_crypto/_layouts/15/download.aspx?SourceUrl=%2Fpersonal%2Fjack%5Fchia%5Fcrypto%2FDocuments%2Ffolder3%5Fchia%5F00mes8r9f5p4ok86%2F{BLOCK}%5Fplot%2Dk32%2D2021%2D08%2D05%2D17%2D49%2Dc51562c946522a44b09a3678d8d084a3a3c35d0d4184cd209fa72a305b9dbd58%2Eplot
https://chiacrypto-my.sharepoint.com/personal/jack_the_farmer_chia_crypto/_layouts/15/download.aspx?SourceUrl=%2Fpersonal%2Fjack%5Fchia%5Fcrypto%2FDocuments%2Ffolder4%5Fchia%5F00mes8r9f5p4ok86%2F{BLOCK}%5Fplot%2Dk32%2D2021%2D08%2D05%2D17%2D49%2Dc51562c946522a44b09a3678d8d084a3a3c35d0d4184cd209fa72a305b9dbd58%2Eplot
```

## Dropbox mode
dropbox  
split file size (positive integer)  
URL list (newline separated, supports LF and CRLF line breaks)  


Dropbox was probably the worst to get going, it doesn't allow you to sensibly share a folder as 1 piece without doing preflight requests (I'm too lazy to do it + it adds latency, which could lead to lower farming efficiency). The solution is to share every single part individually. And no, you don't have to do it manually, remote-utilities folder has a script for that (usage instructions below). You'll need to split plots (see OneDrive mode, it's the same), 16 MB parts recommended again, but around 50 MB has been reported to work just fine.  
Cookie credentials shouldn't be needed here at all.

### Example Dropbox configuration
```
dropbox
314572800
https://dl.dropboxusercontent.com/s/fasfgdfhdgmffgj/1_plot-k32-2021-07-17-13-07-777f29f746e765b92b81c423a4ccf59aae9d19290f6ef9dd4d5687d0fcd9f0d6.plot
https://dl.dropboxusercontent.com/s/keodipvkmgriwpm/2_plot-k32-2021-07-17-13-07-777f29f746e765b92b81c423a4ccf59aae9d19290f6ef9dd4d5687d0fcd9f0d6.plot
https://dl.dropboxusercontent.com/s/e1bhgst5hnb1rbe/3_plot-k32-2021-07-17-13-07-777f29f746e765b92b81c423a4ccf59aae9d19290f6ef9dd4d5687d0fcd9f0d6.plot
https://dl.dropboxusercontent.com/s/wrga81r5g6wrgwr/4_plot-k32-2021-07-17-13-07-777f29f746e765b92b81c423a4ccf59aae9d19290f6ef9dd4d5687d0fcd9f0d6.plot
https://dl.dropboxusercontent.com/s/jzjnfcj1rxtgea1/5_plot-k32-2021-07-17-13-07-777f29f746e765b92b81c423a4ccf59aae9d19290f6ef9dd4d5687d0fcd9f0d6.plot
https://dl.dropboxusercontent.com/s/raevbnh1hs4r5rs/6_plot-k32-2021-07-17-13-07-777f29f746e765b92b81c423a4ccf59aae9d19290f6ef9dd4d5687d0fcd9f0d6.plot
https://dl.dropboxusercontent.com/s/fsd4g565sgf4h98/7_plot-k32-2021-07-17-13-07-777f29f746e765b92b81c423a4ccf59aae9d19290f6ef9dd4d5687d0fcd9f0d6.plot
https://dl.dropboxusercontent.com/s/eht489bfar8fga8/8_plot-k32-2021-07-17-13-07-777f29f746e765b92b81c423a4ccf59aae9d19290f6ef9dd4d5687d0fcd9f0d6.plot
https://dl.dropboxusercontent.com/s/hesjsejlkuj1k65/9_plot-k32-2021-07-17-13-07-777f29f746e765b92b81c423a4ccf59aae9d19290f6ef9dd4d5687d0fcd9f0d6.plot
https://dl.dropboxusercontent.com/s/gwae1g8qg12gdsg/10_plot-k32-2021-07-17-13-07-777f29f746e765b92b81c423a4ccf59aae9d19290f6ef9dd4d5687d0fcd9f0d6.plot
... roughly 300 more URLs with this part size
```

### Share script usage instructions
At first, you need to find your Dropbox CSRF token, PATH_ROOT and UID.  
Go to DevTools (CTRL+SHIFT+I or F12 in Chrome)  
Choose Network tab  
![Step 1 image tutorial](https://kotol.cloud/static/remote_chia_harvester/step1.png)  

Share any file, doesn't matter which.  
In the request list, look for create_shared_link_with_settings, click it, select headers and scroll down. Here you'll find these 3 values. They should remain unchanged for a long time and over all folders.  
![Step 2 image tutorial](https://kotol.cloud/static/remote_chia_harvester/step2.png)  
Input the values into strings at the beginning of the script.  

Now enter path to your folder with plot into SPLIT_PLOT_PATH variable at the beginning of the script. Example ```/Chiaplots/plot42```. DO NOT remove the leading slash, Dropbox will refuse to eat such input.  

Now just copy and paste the script into console (in Developer Tools) while having your Dropbox open and you are logged in to your account. Let it do its thing and in the end, you will get a --remoteplot-- configuration you can just copy and paste. It looks for part numbers at the beginning of file names preceding an underscore _ character, it should work even if it is not like this, but you can never be sure and may end up with improperly sorted part URLs. The split script does it in a way that this share script will be aware of it. If you use a different splitter and part numbering, you may need to modify line 141 to make it understand your numbering.  

# File splitter
A Python script to split a file to many small equally sized parts  
Usage: python file_splitter.py (Path to file for splitting) (Path to folder where all parts are written)  
For a different part size modify the PART_SIZE constant in the script.  

# Build instructions
Build as regular Chia, CMake and your preferred compiler. Now, this fork depends on CURL library to ensure HTTP/S communication.  
For MSVC on Windows, you should use vcpkg, install curl:architecture-os, curl:x64-windows for example. In CMakeLists.txt line 55 you may need to set your vcpkg directory to make the compiler/linker aware of CURL.  
For g++ on Linux, you need to install libcurl4 onto your system. apt-get has it. Then you CMake and make.  

# Install
You first install an official copy of Chia Blockchain (the one this project is a fork of). Then you need to patch stuff up, download also the modified version of chia-blockchain. In folder chia/plotting you'll find manager.py file, this one needs to be replaced. It will allow for recognizing --remoteplot-- in the filename and skipping plot size check in such case. Then, you replace chiapos module, .pyd on Windows, .so on Linux. You compiled the modified one from this repository, you will need to locate your original copy, usually in venv/lib/python3.x/site-packages. And run it as your regular Chia client. Working with Windows GUI is tricky and not definitive, so for now CLI only.

# Donations are highly appreciated :)
XCH: xch1ww744hcsexjrxf3psqdr3jprzj8hu0a72n9wfcjh7adxrnxxwmus0zj6ag
BTC (SegWit): bc1q0x53jm98caggdud2yf4x3yng96s4pzrp92ksnl


# Chia Proof of Space (original description)
![Build](https://github.com/Chia-Network/chiapos/workflows/Build/badge.svg)
![PyPI](https://img.shields.io/pypi/v/chiapos?logo=pypi)
![PyPI - Format](https://img.shields.io/pypi/format/chiapos?logo=pypi)
![GitHub](https://img.shields.io/github/license/Chia-Network/chiapos?logo=Github)

[![Total alerts](https://img.shields.io/lgtm/alerts/g/Chia-Network/chiapos.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/Chia-Network/chiapos/alerts/)
[![Language grade: Python](https://img.shields.io/lgtm/grade/python/g/Chia-Network/chiapos.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/Chia-Network/chiapos/context:python)
[![Language grade: C/C++](https://img.shields.io/lgtm/grade/cpp/g/Chia-Network/chiapos.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/Chia-Network/chiapos/context:cpp)

Chia's proof of space is written in C++. Includes a plotter, prover, and
verifier. It exclusively runs on 64 bit architectures. Read the
[Proof of Space document](https://www.chia.net/assets/Chia_Proof_of_Space_Construction_v1.1.pdf) to
learn about what proof of space is and how it works.

## C++ Usage Instructions

### Compile

```bash
# Requires cmake 3.14+

mkdir -p build && cd build
cmake ../
cmake --build . -- -j 6
```

### Run tests

```bash
./RunTests
```

### CLI usage

```bash
./ProofOfSpace -k 25 -f "plot.dat" -m "0x1234" create
./ProofOfSpace -k 25 -f "final-plot.dat" -m "0x4567" -t TMPDIR -2 SECOND_TMPDIR create
./ProofOfSpace -f "plot.dat" prove <32 byte hex challenge>
./ProofOfSpace -k 25 verify <hex proof> <32 byte hex challenge>
./ProofOfSpace -f "plot.dat" check <iterations>
```

### Benchmark

```bash
time ./ProofOfSpace -k 25 create
```


### Hellman Attacks usage

There is an experimental implementation which implements some of the Hellman
Attacks that can provide significant space savings for the final file.


```bash
./HellmanAttacks -k 18 -f "plot.dat" -m "0x1234" create
./HellmanAttacks -f "plot.dat" check <iterations>
```

## Python

Finally, python bindings are provided in the python-bindings directory.

### Install

```bash
python3 -m venv .venv
. .venv/bin/activate
pip3 install .
```

### Run python tests

Testings uses pytest. Linting uses flake8 and mypy.

```bash
py.test ./tests -s -v
```

## ci Building
The primary build process for this repository is to use GitHub Actions to
build binary wheels for MacOS, Linux (x64 and aarch64), and Windows and publish
them with a source wheel on PyPi. See `.github/workflows/build.yml`. CMake uses
[FetchContent](https://cmake.org/cmake/help/latest/module/FetchContent.html)
to download [pybind11](https://github.com/pybind/pybind11). Building is then
managed by [cibuildwheel](https://github.com/joerick/cibuildwheel). Further
installation is then available via `pip install chiapos` e.g.

## Contributing and workflow
Contributions are welcome and more details are available in chia-blockchain's
[CONTRIBUTING.md](https://github.com/Chia-Network/chia-blockchain/blob/main/CONTRIBUTING.md).

The main branch is usually the currently released latest version on PyPI.
Note that at times chiapos will be ahead of the release version that
chia-blockchain requires in it's main/release version in preparation for a
new chia-blockchain release. Please branch or fork main and then create a
pull request to the main branch. Linear merging is enforced on main and
merging requires a completed review. PRs will kick off a GitHub actions ci build
and analysis of chiapos at
[lgtm.com](https://lgtm.com/projects/g/Chia-Network/chiapos/?mode=list). Please
make sure your build is passing and that it does not increase alerts at lgtm.
