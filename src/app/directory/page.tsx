import alumniData from '@/data/alumni.json';
import type { Alumni } from '@/types/alumni';
import { DirectoryClient } from '@/components/directory/DirectoryClient';

export const metadata = {
  title: 'Directory | Duke Sports Alumni',
};

export default function DirectoryPage() {
  const alumni = alumniData.alumni as Alumni[];
  return <DirectoryClient initialData={alumni} />;
}
