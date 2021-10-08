import sys
import os
import math
import _thread
import time

assert len(sys.argv) == 3

PART_SIZE = 16777216

originalFile = sys.argv[1]
outFolder = sys.argv[2]
orf = originalFile.split("/")[-1]

size = os.stat(originalFile).st_size
totalParts = math.ceil(size / PART_SIZE)

file = open(originalFile, "rb")

readFinished = False
writeFinished = False

partQueue = []
queueLock = _thread.allocate_lock()

timingQueue = []

def readThread():
    global readFinished, partQueue

    print("Read thread started")

    chunk = file.read(PART_SIZE)
    while chunk:
        while len(partQueue) >= 4:
            time.sleep(0.025)

        with queueLock:
            partQueue.append(chunk)

        chunk = file.read(PART_SIZE)

    readFinished = True


def writeThread():
    global writeFinished, partQueue

    print("Write thread started")

    part = 0

    while (len(partQueue) != 0) or (not readFinished):
        while len(partQueue) == 0:
            time.sleep(0.025)

        part += 1
        
        f = open(os.path.join(outFolder, f"{part}_{orf}"), "wb")
        f.write(partQueue[0])
        f.close()

        timingQueue.append(time.time())
        if len(timingQueue) > 8:
            timingQueue.pop(0)
        
        if len(timingQueue) > 1:
            speed = 16 * len(timingQueue) / (timingQueue[-1] - timingQueue[0])
        else:
            speed = 0
        
        percent = "%.2f" % (part / totalParts * 100)
        speedString = "%.2f" % speed
        if len(speedString) <= 7:
            speedString = " " * (7 - len(speedString)) + speedString
        print(f"\rWrote part {part}/{totalParts} ({percent}%), speed: {speedString} MiB/s, queue size: {len(partQueue)}", end="")

        with queueLock:
            partQueue.pop(0)

    writeFinished = True


_thread.start_new_thread(readThread, ())
_thread.start_new_thread(writeThread, ())

while (not readFinished) or (not writeFinished):
    time.sleep(0.5)

print("")