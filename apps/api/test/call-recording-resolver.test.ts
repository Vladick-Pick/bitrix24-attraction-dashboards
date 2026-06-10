import { describe, expect, it, vi } from "vitest";

import { resolveCallRecordingDownload } from "../src/server/call-recording-resolver";

describe("resolveCallRecordingDownload", () => {
  it("prefers Bitrix Disk file downloads over direct call record URLs when activity files exist", async () => {
    const client = {
      listCallRecordingActivitiesByIds: vi.fn().mockResolvedValue([
        {
          ID: "508492",
          FILES: [
            {
              id: 338028,
              url: "https://bitrix.example/not-the-mp3"
            }
          ],
          STORAGE_ELEMENT_IDS: ["338028"]
        }
      ]),
      getDiskFile: vi.fn().mockResolvedValue({
        ID: "338028",
        DOWNLOAD_URL: "https://download.example/record.mp3"
      })
    };

    await expect(
      resolveCallRecordingDownload({
        client,
        call: {
          ID: "221736",
          CRM_ACTIVITY_ID: "508492",
          CALL_RECORD_URL: "https://slow.example/direct-record.mp3"
        }
      })
    ).resolves.toEqual({
      callId: "221736",
      source: "bitrix_disk",
      url: "https://download.example/record.mp3",
      activityId: "508492",
      fileId: "338028"
    });

    expect(client.getDiskFile).toHaveBeenCalledWith("338028");
  });

  it("uses direct call record URLs when Bitrix activity files are unavailable", async () => {
    const client = {
      listCallRecordingActivitiesByIds: vi.fn().mockResolvedValue([]),
      getDiskFile: vi.fn()
    };

    await expect(
      resolveCallRecordingDownload({
        client,
        call: {
          ID: "221722",
          CRM_ACTIVITY_ID: "508100",
          CALL_RECORD_URL: "https://download.example/direct-record.mp3"
        }
      })
    ).resolves.toEqual({
      callId: "221722",
      source: "call_record_url",
      url: "https://download.example/direct-record.mp3",
      activityId: "508100",
      fileId: null
    });

    expect(client.getDiskFile).not.toHaveBeenCalled();
  });
});
