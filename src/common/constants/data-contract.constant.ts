/**
 * Constants cho Data Contract v1.
 * Tập trung các giá trị cấu hình liên quan đến chất lượng dữ liệu và schema version.
 */

/** Phiên bản hiện tại của Data Contract schema */
export const DATA_CONTRACT_SCHEMA_VERSION = '1.0.0';

/** Ngưỡng số từ tối thiểu; dưới ngưỡng này page bị gắn cảnh báo TOO_SHORT */
export const DATA_QUALITY_MIN_WORD_COUNT = 50;

/** Ngưỡng điểm chất lượng tối thiểu; dưới ngưỡng này page bị gắn cảnh báo LOW_QUALITY_SCORE */
export const DATA_QUALITY_MIN_SCORE = 30;

/**
 * Thuật toán hash dùng để tạo contentHash cho nội dung page.
 * Dùng 'sha256' để đảm bảo đủ entropy cho việc phát hiện duplicate.
 */
export const DATA_CONTRACT_HASH_ALGORITHM = 'sha256';
