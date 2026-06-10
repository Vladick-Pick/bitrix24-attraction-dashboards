import type {
  CallRecordingActivityRow,
  DiskFileRow
} from "../bitrix/client.js";

export interface CallRecordingResolverClient {
  listCallRecordingActivitiesByIds(
    activityIds: string[]
  ): Promise<CallRecordingActivityRow[]>;
  getDiskFile(fileId: string | number): Promise<DiskFileRow | null>;
}

export interface CallRecordingCandidate {
  ID: string | number;
  CRM_ACTIVITY_ID?: string | number | null;
  CALL_RECORD_URL?: string | null;
}

export interface ResolvedCallRecordingDownload {
  callId: string;
  source: "bitrix_disk" | "call_record_url";
  url: string;
  activityId: string | null;
  fileId: string | null;
}

export async function resolveCallRecordingDownload(input: {
  client: CallRecordingResolverClient;
  call: CallRecordingCandidate;
}): Promise<ResolvedCallRecordingDownload | null> {
  const callId = String(input.call.ID);
  const activityId = normalizeId(input.call.CRM_ACTIVITY_ID);

  if (activityId) {
    const activities = await input.client.listCallRecordingActivitiesByIds([
      activityId
    ]);
    const activity = activities.find((row) => String(row.ID) === activityId);
    const fileId = activity ? extractRecordingFileId(activity) : null;

    if (fileId) {
      const diskFile = await input.client.getDiskFile(fileId);
      const downloadUrl = normalizeUrl(diskFile?.DOWNLOAD_URL);

      if (downloadUrl) {
        return {
          callId,
          source: "bitrix_disk",
          url: downloadUrl,
          activityId,
          fileId
        };
      }
    }
  }

  const directUrl = normalizeUrl(input.call.CALL_RECORD_URL);
  if (directUrl) {
    return {
      callId,
      source: "call_record_url",
      url: directUrl,
      activityId,
      fileId: null
    };
  }

  return null;
}

function extractRecordingFileId(activity: CallRecordingActivityRow) {
  for (const file of activity.FILES ?? []) {
    const id = normalizeId(file.id ?? file.ID);
    if (id) {
      return id;
    }
  }

  for (const id of activity.STORAGE_ELEMENT_IDS ?? []) {
    const normalizedId = normalizeId(id);
    if (normalizedId) {
      return normalizedId;
    }
  }

  return null;
}

function normalizeId(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
