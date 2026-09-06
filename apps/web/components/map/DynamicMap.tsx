import dynamic from 'next/dynamic';

const DynamicMap = dynamic(() => import('./MapClient'), {
  ssr: false,
  loading: () => <div className="flex-1 w-full h-full bg-gray-100 flex items-center justify-center">Loading Map...</div>
});

export default DynamicMap;
