/**
 * SourceIcon - نمایش آیکون/لوگو برای انواع مختلف Source
 *
 * Features:
 * - آیکون‌های اختصاصی برای هر نوع دیتابیس/source
 * - رنگ‌بندی منحصر به فرد برای هر نوع
 * - قابلیت سفارشی‌سازی اندازه
 */

import React from 'react';
import {
  CircleStackIcon,
  CloudIcon,
  ServerStackIcon,
  DocumentIcon,
  GlobeAltIcon,
  CpuChipIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';

export type SourceType =
  | 'PostgreSQL'
  | 'MySQL'
  | 'MongoDB'
  | 'Oracle'
  | 'SQLServer'
  | 'S3'
  | 'Azure'
  | 'GCS'
  | 'Kafka'
  | 'API'
  | 'File'
  | 'CSV'
  | 'Excel'
  | 'RDBMS'
  | 'NoSQL'
  | string;

interface SourceIconProps {
  sourceType?: string;
  className?: string;
  showBackground?: boolean;
}

/**
 * Map source types to their icons and colors
 */
const SOURCE_CONFIG: Record<
  string,
  {
    icon: typeof CircleStackIcon;
    bgColor: string;
    iconColor: string;
    label: string;
  }
> = {
  // Relational Databases
  postgresql: {
    icon: CircleStackIcon,
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    label: 'PostgreSQL',
  },
  mysql: {
    icon: CircleStackIcon,
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
    label: 'MySQL',
  },
  oracle: {
    icon: CircleStackIcon,
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    label: 'Oracle',
  },
  sqlserver: {
    icon: CircleStackIcon,
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    iconColor: 'text-gray-600 dark:text-gray-400',
    label: 'SQL Server',
  },
  mssql: {
    icon: CircleStackIcon,
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    iconColor: 'text-gray-600 dark:text-gray-400',
    label: 'MSSQL',
  },
  rdbms: {
    icon: CircleStackIcon,
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    label: 'RDBMS',
  },

  // NoSQL Databases
  mongodb: {
    icon: CircleStackIcon,
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    label: 'MongoDB',
  },
  cassandra: {
    icon: CircleStackIcon,
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    label: 'Cassandra',
  },
  redis: {
    icon: ServerStackIcon,
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    label: 'Redis',
  },
  nosql: {
    icon: CircleStackIcon,
    bgColor: 'bg-teal-100 dark:bg-teal-900/30',
    iconColor: 'text-teal-600 dark:text-teal-400',
    label: 'NoSQL',
  },

  // Cloud Storage
  s3: {
    icon: CloudIcon,
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
    label: 'Amazon S3',
  },
  azure: {
    icon: CloudIcon,
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    label: 'Azure',
  },
  gcs: {
    icon: CloudIcon,
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    label: 'Google Cloud Storage',
  },

  // Streaming
  kafka: {
    icon: ServerStackIcon,
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
    label: 'Kafka',
  },

  // API
  api: {
    icon: GlobeAltIcon,
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    label: 'API',
  },
  rest: {
    icon: GlobeAltIcon,
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    label: 'REST API',
  },
  graphql: {
    icon: GlobeAltIcon,
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
    iconColor: 'text-pink-600 dark:text-pink-400',
    label: 'GraphQL',
  },

  // Files
  file: {
    icon: DocumentIcon,
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    iconColor: 'text-gray-600 dark:text-gray-400',
    label: 'File',
  },
  csv: {
    icon: TableCellsIcon,
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    label: 'CSV',
  },
  excel: {
    icon: TableCellsIcon,
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    label: 'Excel',
  },
  json: {
    icon: DocumentIcon,
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    label: 'JSON',
  },
  parquet: {
    icon: DocumentIcon,
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    label: 'Parquet',
  },

  // Default
  default: {
    icon: CpuChipIcon,
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    iconColor: 'text-gray-600 dark:text-gray-400',
    label: 'Source',
  },
};

export const SourceIcon: React.FC<SourceIconProps> = ({
  sourceType,
  className = 'w-5 h-5',
  showBackground = true,
}) => {
  // Normalize source type (lowercase, remove spaces)
  const normalizedType = sourceType?.toLowerCase().replace(/[\s-_]/g, '') || 'default';
  
  // Get config or fallback to default
  const config = SOURCE_CONFIG[normalizedType] || SOURCE_CONFIG.default;
  
  const Icon = config.icon;

  if (showBackground) {
    return (
      <div className={`p-1.5 rounded ${config.bgColor} inline-flex items-center justify-center`}>
        <Icon className={`${className} ${config.iconColor}`} />
      </div>
    );
  }

  return <Icon className={`${className} ${config.iconColor}`} />;
};

/**
 * Get source type label
 */
export const getSourceTypeLabel = (sourceType?: string): string => {
  if (!sourceType) return 'Source';
  const normalizedType = sourceType.toLowerCase().replace(/[\s-_]/g, '');
  return SOURCE_CONFIG[normalizedType]?.label || sourceType;
};

export default SourceIcon;
