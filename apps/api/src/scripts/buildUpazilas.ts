import fs from 'fs';
import path from 'path';

// Complete BBS 495 Upazilas Roster by Division and District
interface RawUpazila {
  nameEn: string;
  nameBn: string;
  districtEn: string;
  districtBn: string;
  divisionEn: string;
  divisionBn: string;
  latitude?: number;
  longitude?: number;
  aliasesEn?: string[];
  aliasesBn?: string[];
}

const DISTRICT_NAMES_BN: Record<string, string> = {
  // Dhaka
  Dhaka: 'ঢাকা', Gazipur: 'গাজীপুর', Narayanganj: 'নারায়ণগঞ্জ', Narsingdi: 'নরসিংদী',
  Tangail: 'টাঙ্গাইল', Kishoreganj: 'কিশোরগঞ্জ', Manikganj: 'মানিকগঞ্জ', Munshiganj: 'মুন্সীগঞ্জ',
  Faridpur: 'ফরিদপুর', Gopalganj: 'গোপালগঞ্জ', Madaripur: 'মাদারীপুর', Rajbari: 'রাজবাড়ী',
  Shariatpur: 'শরীয়তপুর',
  // Chattogram
  Chattogram: 'চট্টগ্রাম', "Cox's Bazar": 'কক্সবাজার', Cumilla: 'কুমিল্লা',
  Feni: 'ফেনী', Brahmanbaria: 'ব্রাহ্মণবাড়িয়া', Noakhali: 'নোয়াখালী',
  Lakshmipur: 'লক্ষ্মীপুর', Chandpur: 'চাঁদপুর', Rangamati: 'রাঙ্গামাটি',
  Khagrachhari: 'খাগড়াছড়ি', Bandarban: 'বান্দরবান',
  // Rajshahi
  Rajshahi: 'রাজশাহী', Bogura: 'বগুড়া', Pabna: 'পাবনা', Sirajganj: 'সিরাজগঞ্জ',
  Naogaon: 'নওগাঁ', Natore: 'নাটোর', Chapainawabganj: 'চাঁপাইনবাবগঞ্জ', Joypurhat: 'জয়পুরহাট',
  // Khulna
  Khulna: 'খুলনা', Jashore: 'যশোর', Satkhira: 'সাতক্ষীরা', Bagerhat: 'বাগেরহাট',
  Kushtia: 'কুষ্টিয়া', Jhenaidah: 'ঝিনাইদহ', Chuadanga: 'চুয়াডাঙ্গা', Magura: 'মাগুরা',
  Meherpur: 'মেহেরপুর', Narail: 'নড়াইল',
  // Barishal
  Barishal: 'বরিশাল', Patuakhali: 'পটুয়াখালী', Bhola: 'ভোলা', Pirojpur: 'পিরোজপুর',
  Barguna: 'বরগুনা', Jhalakathi: 'ঝালকাঠি',
  // Sylhet
  Sylhet: 'সিলেট', Moulvibazar: 'মৌলভীবাজার', Habiganj: 'হবিগঞ্জ', Sunamganj: 'সুনামগঞ্জ',
  // Rangpur
  Rangpur: 'রংপুর', Dinajpur: 'দিনাজপুর', Kurigram: 'কুড়িগ্রাম', Gaibandha: 'গাইবান্ধা',
  Nilphamari: 'নীলফামারী', Panchagarh: 'পঞ্চগড়', Thakurgaon: 'ঠাকুরগাঁও', Lalmonirhat: 'লালমনিরহাট',
  // Mymensingh
  Mymensingh: 'ময়মনসিংহ', Jamalpur: 'জামালপুর', Netrokona: 'নেত্রকোণা', Sherpur: 'শেরপুর',
};

const DIVISION_NAMES_BN: Record<string, string> = {
  Dhaka: 'ঢাকা',
  Chattogram: 'চট্টগ্রাম',
  Rajshahi: 'রাজশাহী',
  Khulna: 'খুলনা',
  Barishal: 'বরিশাল',
  Sylhet: 'সিলেট',
  Rangpur: 'রংপুর',
  Mymensingh: 'ময়মনসিংহ',
};

// District-to-Division Map
const DISTRICT_TO_DIV: Record<string, string> = {
  Dhaka: 'Dhaka', Gazipur: 'Dhaka', Narayanganj: 'Dhaka', Narsingdi: 'Dhaka',
  Tangail: 'Dhaka', Kishoreganj: 'Dhaka', Manikganj: 'Dhaka', Munshiganj: 'Dhaka',
  Faridpur: 'Dhaka', Gopalganj: 'Dhaka', Madaripur: 'Dhaka', Rajbari: 'Dhaka',
  Shariatpur: 'Dhaka',
  Chattogram: 'Chattogram', "Cox's Bazar": 'Chattogram', Cumilla: 'Chattogram',
  Feni: 'Chattogram', Brahmanbaria: 'Chattogram', Noakhali: 'Chattogram',
  Lakshmipur: 'Chattogram', Chandpur: 'Chattogram', Rangamati: 'Chattogram',
  Khagrachhari: 'Chattogram', Bandarban: 'Chattogram',
  Rajshahi: 'Rajshahi', Bogura: 'Rajshahi', Pabna: 'Rajshahi', Sirajganj: 'Rajshahi',
  Naogaon: 'Rajshahi', Natore: 'Rajshahi', Chapainawabganj: 'Rajshahi', Joypurhat: 'Rajshahi',
  Khulna: 'Khulna', Jashore: 'Khulna', Satkhira: 'Khulna', Bagerhat: 'Khulna',
  Kushtia: 'Khulna', Jhenaidah: 'Khulna', Chuadanga: 'Khulna', Magura: 'Khulna',
  Meherpur: 'Khulna', Narail: 'Khulna',
  Barishal: 'Barishal', Patuakhali: 'Barishal', Bhola: 'Barishal', Pirojpur: 'Barishal',
  Barguna: 'Barishal', Jhalakathi: 'Barishal',
  Sylhet: 'Sylhet', Moulvibazar: 'Sylhet', Habiganj: 'Sylhet', Sunamganj: 'Sylhet',
  Rangpur: 'Rangpur', Dinajpur: 'Rangpur', Kurigram: 'Rangpur', Gaibandha: 'Rangpur',
  Nilphamari: 'Rangpur', Panchagarh: 'Rangpur', Thakurgaon: 'Rangpur', Lalmonirhat: 'Rangpur',
  Mymensingh: 'Mymensingh', Jamalpur: 'Mymensingh', Netrokona: 'Mymensingh', Sherpur: 'Mymensingh',
};

// Canonical Upazila List with English and Bengali Names (495 Upazilas across 64 Districts)
const UPAZILAS_DEF: Record<string, [string, string][]> = {
  // DHAKA DIVISION (89)
  Dhaka: [
    ['Dhamrai', 'ধামরাই'], ['Dohar', 'দোহার'], ['Keraniganj', 'কেরানীগঞ্জ'],
    ['Nawabganj', 'নবাবগঞ্জ'], ['Savar', 'সাভার']
  ],
  Gazipur: [
    ['Gazipur Sadar', 'গাজীপুর সদর'], ['Kaliakair', 'কালিয়াকৈর'], ['Kaliganj', 'কালীগঞ্জ'],
    ['Kapasia', 'কাপাসিয়া'], ['Sreepur', 'শ্রীপুর']
  ],
  Narayanganj: [
    ['Araihazar', 'আড়াইহাজার'], ['Bandar', 'বন্দর'], ['Narayanganj Sadar', 'নারায়ণগঞ্জ সদর'],
    ['Rupganj', 'রূপগঞ্জ'], ['Sonargaon', 'সোনারগাঁও']
  ],
  Narsingdi: [
    ['Belabo', 'বেলাবো'], ['Monohardi', 'মনোহরদী'], ['Narsingdi Sadar', 'নরসিংদী সদর'],
    ['Palash', 'পলাশ'], ['Raipura', 'রায়পুরা'], ['Shibpur', 'শিবপুর']
  ],
  Tangail: [
    ['Basail', 'বাসাইল'], ['Bhuapur', 'ভূঞাপুর'], ['Delduar', 'দেলদুয়ার'],
    ['Dhanbari', 'ধনবাড়ী'], ['Ghatail', 'ঘাটাইল'], ['Gopalpur', 'গোপালপুর'],
    ['Kalihati', 'কালিহাতী'], ['Madhupur', 'মধুপুর'], ['Mirzapur', 'মির্জাপুর'],
    ['Nagarpur', 'নাগরপুর'], ['Sakhipur', 'সখিপুর'], ['Tangail Sadar', 'টাঙ্গাইল সদর']
  ],
  Kishoreganj: [
    ['Astagram', 'অষ্টগ্রাম'], ['Bajitpur', 'বাজিতপুর'], ['Bhairab', 'ভৈরব'],
    ['Hossainpur', 'হোসেনপুর'], ['Itna', 'ইটনা'], ['Karimganj', 'করিমগঞ্জ'],
    ['Katiadi', 'কটিয়াদী'], ['Kishoreganj Sadar', 'কিশোরগঞ্জ সদর'], ['Kuliarchar', 'কুলিয়ারচর'],
    ['Mithamain', 'মিঠামইন'], ['Nikli', 'নিকলী'], ['Pakundia', 'পাকুন্দিয়া'], ['Tarail', 'তাড়াইল']
  ],
  Manikganj: [
    ['Daulatpur', 'দৌলতপুর'], ['Ghior', 'ঘিওরে'], ['Harirampur', 'হরিরামপুর'],
    ['Manikganj Sadar', 'মানিকগঞ্জ সদর'], ['Saturia', 'সাটুরিয়া'], ['Shivalaya', 'শিবালয়'],
    ['Singair', 'সিংগাইর']
  ],
  Munshiganj: [
    ['Gazaria', 'গজারিয়া'], ['Louhajang', 'লৌহজং'], ['Munshiganj Sadar', 'মুন্সীগঞ্জ সদর'],
    ['Sirajdikhan', 'সিরাজদিখান'], ['Sreenagar', 'শ্রীনগর'], ['Tongibari', 'টঙ্গীবাড়ী']
  ],
  Faridpur: [
    ['Alfadanga', 'আলফাডাঙ্গা'], ['Bhanga', 'ভাঙ্গা'], ['Boalmari', 'বোয়ালমারী'],
    ['Charbhadrasan', 'চরভদ্রাসন'], ['Faridpur Sadar', 'ফরিদপুর সদর'], ['Madhukhali', 'মধুখালী'],
    ['Nagarkanda', 'নগরকান্দা'], ['Sadarpur', 'সদরপুর'], ['Saltha', 'সালথা']
  ],
  Gopalganj: [
    ['Gopalganj Sadar', 'গোপালগঞ্জ সদর'], ['Kashiani', 'কাশিয়ানী'], ['Kotalipara', 'কোটালীপাড়া'],
    ['Muksudpur', 'মুকসুদপুর'], ['Tungipara', 'টুঙ্গিপাড়া']
  ],
  Madaripur: [
    ['Kalkini', 'কালকিনি'], ['Madaripur Sadar', 'মাদারীপুর সদর'], ['Rajoir', 'রাজৈর'],
    ['Shibchar', 'শিবচর'], ['Dasar', 'ডাসার']
  ],
  Rajbari: [
    ['Baliakandi', 'বালিয়াকান্দি'], ['Goalandaghat', 'গোয়ালন্দঘাট'], ['Kalukhali', 'কালুখালী'],
    ['Pangsha', 'পাংশা'], ['Rajbari Sadar', 'রাজবাড়ী সদর']
  ],
  Shariatpur: [
    ['Bhedarganj', 'ভেদরগঞ্জ'], ['Damudya', 'ডামুড্যা'], ['Gosairhat', 'গোসাইরহাট'],
    ['Naria', 'নড়িয়া'], ['Shariatpur Sadar', 'শরীয়তপুর সদর'], ['Zanjira', 'জাজিরা']
  ],

  // CHATTOGRAM DIVISION (104)
  Chattogram: [
    ['Anwara', 'আনোয়ারা'], ['Banshkhali', 'বাঁশখালী'], ['Boalkhali', 'বোয়ালখালী'],
    ['Chandanaish', 'চন্দনাইশ'], ['Fatikchhari', 'ফটিকছড়ি'], ['Hathazari', 'হাটহাজারী'],
    ['Karnaphuli', 'কর্ণফুলী'], ['Lohagara', 'লোহাগাড়া'], ['Mirsharai', 'মীরসরাই'],
    ['Patiya', 'পটিয়া'], ['Rangunia', 'রাঙ্গুনিয়া'], ['Raozan', 'রাউজান'],
    ['Sandwip', 'সন্দ্বীপ'], ['Satkania', 'সাতকানিয়া'], ['Sitakunda', 'সীতাকুণ্ড']
  ],
  "Cox's Bazar": [
    ['Chakaria', 'চকোরিয়া'], ["Cox's Bazar Sadar", 'কক্সবাজার সদর'], ['Kutubdia', 'কুতুবদিয়া'],
    ['Maheshkhali', 'মহেশখালী'], ['Pekua', 'পেকুয়া'], ['Ramu', 'রামু'],
    ['Teknaf', 'টেকনাফ'], ['Ukhia', 'উখিয়া'], ['Eidgaon', 'ঈদগাঁও']
  ],
  Cumilla: [
    ['Barura', 'বরুড়া'], ['Brahmanpara', 'ব্রাহ্মণপাড়া'], ['Burichang', 'বুড়িচং'],
    ['Chandina', 'চান্দিনা'], ['Chauddagram', 'চৌদ্দগ্রাম'], ['Daudkandi', 'দাউদকান্দি'],
    ['Debidwar', 'দেবিদ্বার'], ['Homna', 'হোমনা'], ['Laksam', 'লাকসাম'],
    ['Lalmai', 'লালমাই'], ['Meghna', 'মেঘনা'], ['Monohargonj', 'মনোহরগঞ্জ'],
    ['Muradnagar', 'মুরাদনগর'], ['Nangalkot', 'নাঙ্গলকোট'], ['Cumilla Sadar', 'কুমিল্লা সদর'],
    ['Cumilla Sadar Dakshin', 'কুমিল্লা সদর দক্ষিণ'], ['Titas', 'তিতাস']
  ],
  Feni: [
    ['Chhagalnaiya', 'ছাগলনাইয়া'], ['Daganbhuiyan', 'দাগনভূঞা'], ['Feni Sadar', 'ফেনী সদর'],
    ['Parshuram', 'পরশুরাম'], ['Sonagazi', 'সোনাগাজী'], ['Fulgazi', 'ফুলগাজী']
  ],
  Brahmanbaria: [
    ['Akhaura', 'আখাউড়া'], ['Ashuganj', 'আশুগঞ্জ'], ['Bancharampur', 'বাঞ্ছারামপুর'],
    ['Bijoynagar', 'বিজয়নগর'], ['Brahmanbaria Sadar', 'ব্রাহ্মণবাড়িয়া সদর'], ['Kasba', 'কসবা'],
    ['Nabinagar', 'নবীনগর'], ['Nasirnagar', 'নাসিরনগর'], ['Sarail', 'সরাইল']
  ],
  Noakhali: [
    ['Begumganj', 'বেগমগঞ্জ'], ['Chatkhil', 'চাটখিল'], ['Companiganj', 'কোম্পানীগঞ্জ'],
    ['Hatiya', 'হাতিয়া'], ['Kabirhat', 'কবিরহাট'], ['Senbagh', 'সেনবাগ'],
    ['Sonaimuri', 'সোনাইমুড়ী'], ['Subarnachar', 'সুবর্ণচর'], ['Noakhali Sadar', 'নোয়াখালী সদর']
  ],
  Lakshmipur: [
    ['Kamalnagar', 'কমলনগর'], ['Lakshmipur Sadar', 'লক্ষ্মীপুর সদর'], ['Raipur', 'রায়পুর'],
    ['Ramganj', 'রামগঞ্জ'], ['Ramgati', 'রামগতি']
  ],
  Chandpur: [
    ['Chandpur Sadar', 'চাঁদপুর সদর'], ['Faridganj', 'ফরিদগঞ্জ'], ['Haimchar', 'হাইমচর'],
    ['Haziganj', 'হাজীগঞ্জ'], ['Kachua', 'কচুয়া'], ['Matlab Dakshin', 'মতলব দক্ষিণ'],
    ['Matlab Uttar', 'মতলব উত্তর'], ['Shahrasti', 'শাহরাস্তি']
  ],
  Bandarban: [
    ['Ali Kadam', 'আলীকদম'], ['Bandarban Sadar', 'বান্দরবান সদর'], ['Lama', 'লামা'],
    ['Naikhongchhari', 'নাইক্ষ্যংছড়ি'], ['Rowangchhari', 'রোয়াংছড়ি'], ['Ruma', 'রুমা'],
    ['Thanchi', 'থানচি']
  ],
  Rangamati: [
    ['Baghaichhari', 'বাঘাইছড়ি'], ['Barkal', 'বরকল'], ['Belaichhari', 'বিলাইছড়ি'],
    ['Juraichhari', 'জুরাইছড়ি'], ['Kaptai', 'কাপ্তাই'], ['Kawkhali', 'কাউখালী'],
    ['Langadu', 'লংগদু'], ['Naniarchar', 'নানিয়ারচর'], ['Rajasthali', 'রাজস্থলী'],
    ['Rangamati Sadar', 'রাঙ্গামাটি সদর']
  ],
  Khagrachhari: [
    ['Dighinala', 'দিঘীনালা'], ['Guimara', 'গুইমারা'], ['Khagrachhari Sadar', 'খাগড়াছড়ি সদর'],
    ['Lakshmichhari', 'লক্ষ্মীছড়ি'], ['Mahalchhari', 'মহালছড়ি'], ['Manikchhari', 'মানিকছড়ি'],
    ['Matiranga', 'মাটিরাঙ্গা'], ['Panchhari', 'পানছড়ি'], ['Ramgarh', 'রামগড়']
  ],

  // RAJSHAHI DIVISION (67)
  Rajshahi: [
    ['Bagha', 'বাঘা'], ['Bagmara', 'বাগমারা'], ['Charghat', 'চারঘাট'],
    ['Durgapur', 'দুর্গাপুর'], ['Godagari', 'গোদাগাড়ী'], ['Mohanpur', 'মোহনপুর'],
    ['Paba', 'পবা'], ['Puthia', 'পুঠিয়া'], ['Tanore', 'তানোর']
  ],
  Bogura: [
    ['Adamdighi', 'আদমদীঘি'], ['Bogura Sadar', 'বগুড়া সদর'], ['Dhunat', 'ধুনট'],
    ['Dhupchanchia', 'দুপচাঁচিয়া'], ['Gabtali', 'গাবতলী'], ['Kahaloo', 'কাহালু'],
    ['Nandigram', 'নন্দীগ্রাম'], ['Sariakandi', 'সারিয়াকান্দি'], ['Shajahanpur', 'শাজাহানপুর'],
    ['Sherpur', 'শেরপুর'], ['Shibganj', 'শিবগঞ্জ'], ['Sonatola', 'সোনাতলা']
  ],
  Pabna: [
    ['Atgharia', 'আটঘরিয়া'], ['Bera', 'বেড়া'], ['Bhangura', 'ভাঙ্গুড়া'],
    ['Chatmohar', 'চাটমোহর'], ['Faridpur', 'ফরিদপুর'], ['Ishwardi', 'ঈশ্বরদী'],
    ['Santhia', 'সাঁথিয়া'], ['Sujanagar', 'সুজানগর'], ['Pabna Sadar', 'পাবনা সদর']
  ],
  Sirajganj: [
    ['Belkuchi', 'বেলকুচি'], ['Chauhali', 'চৌহালী'], ['Kamarkhanda', 'কামারখন্দ'],
    ['Kazipur', 'কাজীপুর'], ['Raiganj', 'রায়গঞ্জ'], ['Shahjadpur', 'শাহজাদপুর'],
    ['Sirajganj Sadar', 'সিরাজগঞ্জ সদর'], ['Tarash', 'তাড়াশ'], ['Ullahpara', 'উল্লাপাড়া']
  ],
  Naogaon: [
    ['Atrai', 'আত্রাই'], ['Badalgachhi', 'বদলগাছী'], ['Dhamoirhat', 'ধামইরহাট'],
    ['Manda', 'মান্দা'], ['Mohadevpur', 'মহাদেবপুর'], ['Naogaon Sadar', 'নওগাঁ সদর'],
    ['Niamatpur', 'নিয়ামতপুর'], ['Patnitala', 'পত্নীতলা'], ['Porsha', 'পোরশা'],
    ['Raninagar', 'রাণীনগর'], ['Sapahar', 'সাপাহার']
  ],
  Natore: [
    ['Bagatipara', 'বাগাতিপাড়া'], ['Baraigram', 'বড়াইগ্রাম'], ['Gurudaspur', 'গুরুদাসপুর'],
    ['Lalpur', 'লালপুর'], ['Natore Sadar', 'নাটোর সদর'], ['Singra', 'সিংড়া'],
    ['Naldanga', 'নলডাঙ্গা']
  ],
  Chapainawabganj: [
    ['Bholahat', 'ভোলাহাট'], ['Gomastapur', 'গোমস্তাপুর'], ['Nachole', 'নাচোল'],
    ['Chapainawabganj Sadar', 'চাঁপাইনবাবগঞ্জ সদর'], ['Shibganj', 'শিবগঞ্জ']
  ],
  Joypurhat: [
    ['Akkelpur', 'আক্কেলপুর'], ['Joypurhat Sadar', 'জয়পুরহাট সদর'], ['Kalai', 'কালাই'],
    ['Khetlal', 'ক্ষেতলাল'], ['Panchbibi', 'পাঁচবিবি']
  ],

  // RANGPUR DIVISION (58)
  Rangpur: [
    ['Badarganj', 'বদরগঞ্জ'], ['Gangachhara', 'গংগাচড়া'], ['Kaunia', 'কাউনিয়া'],
    ['Rangpur Sadar', 'রংপুর সদর'], ['Mithapukur', 'মিঠাপুকুর'], ['Pirgachha', 'পীরগাছা'],
    ['Pirganj', 'পীরগঞ্জ'], ['Taraganj', 'তারাগঞ্জ']
  ],
  Dinajpur: [
    ['Birampur', 'বিরামপুর'], ['Birganj', 'বীরগঞ্জ'], ['Birol', 'বিরল'],
    ['Bochaganj', 'বোচাগঞ্জ'], ['Chirirbandar', 'চিরিরবন্দর'], ['Phulbari', 'ফুলবাড়ী'],
    ['Ghoraghat', 'ঘোড়াঘাট'], ['Hakimpur', 'হাকিমপুর'], ['Kaharole', 'কাহারোল'],
    ['Khansama', 'খানসামা'], ['Dinajpur Sadar', 'দিনাজপুর সদর'], ['Nawabganj', 'নবাবগঞ্জ'],
    ['Parbatipur', 'পার্বতীপুর']
  ],
  Kurigram: [
    ['Bhurungamari', 'ভুরুঙ্গামারী'], ['Char Rajibpur', 'চর রাজিবপুর'], ['Chilmari', 'চিলমারী'],
    ['Phulbari', 'ফুলবাড়ী'], ['Kurigram Sadar', 'কুড়িগ্রাম সদর'], ['Nageshwari', 'নাগেশ্বরী'],
    ['Rajarhat', 'রাজারহাট'], ['Raomari', 'রৌমারী'], ['Ulipur', 'উলিপুর']
  ],
  Gaibandha: [
    ['Phulchhari', 'ফুলছড়ি'], ['Gaibandha Sadar', 'গাইবান্ধা সদর'], ['Gobindaganj', 'গোবিন্দগঞ্জ'],
    ['Palashbari', 'পলাশবাড়ী'], ['Sadullapur', 'সাদুল্লাপুর'], ['Sughatta', 'সাঘাটা'],
    ['Sundarganj', 'সুন্দরগঞ্জ']
  ],
  Nilphamari: [
    ['Dimla', 'ডিমলা'], ['Domar', 'ডোমার'], ['Jaldhaka', 'জলঢাকা'],
    ['Kishoreganj', 'কিশোরগঞ্জ'], ['Nilphamari Sadar', 'নীলফামারী সদর'], ['Saidpur', 'সৈয়দপুর']
  ],
  Lalmonirhat: [
    ['Aditmari', 'আদিতমারী'], ['Hatibandha', 'হাতীবান্ধা'], ['Kaliganj', 'কালীগঞ্জ'],
    ['Lalmonirhat Sadar', 'লালমনিরহাট সদর'], ['Patgram', 'পাটগ্রাম']
  ],
  Panchagarh: [
    ['Atwari', 'আটোয়ারী'], ['Boda', 'বোদা'], ['Debiganj', 'দেবীগঞ্জ'],
    ['Panchagarh Sadar', 'পঞ্চগড় সদর'], ['Tetulia', 'তেঁতুলিয়া']
  ],
  Thakurgaon: [
    ['Baliadangi', 'বালিয়াডাঙ্গী'], ['Haripur', 'হরিপুর'], ['Pirganj', 'পীরগঞ্জ'],
    ['Ranisankhail', 'রাণীশংকৈল'], ['Thakurgaon Sadar', 'ঠাকুরগাঁও সদর']
  ],

  // MYMENSINGH DIVISION (35)
  Mymensingh: [
    ['Bhaluka', 'ভালুকা'], ['Dhobaura', 'ধোবাউড়া'], ['Fulbaria', 'ফুলবাড়ীয়া'],
    ['Gaffargaon', 'গফরগাঁও'], ['Gauripur', 'গৌরীপুর'], ['Haluaghat', 'হালুয়াঘাট'],
    ['Ishwarganj', 'ঈশ্বরগঞ্জ'], ['Mymensingh Sadar', 'ময়মনসিংহ সদর'], ['Muktagachha', 'মুক্তাগাছা'],
    ['Nandail', 'নান্দাইল'], ['Phulpur', 'ফুলপুর'], ['Trishal', 'ত্রিশাল'], ['Tara Khanda', 'তারাকান্দা']
  ],
  Jamalpur: [
    ['Baksiganj', 'বকশীগঞ্জ'], ['Dewanganj', 'দেওয়ানগঞ্জ'], ['Islampur', 'ইসলামপুর'],
    ['Jamalpur Sadar', 'জামালপুর সদর'], ['Madarganj', 'মাদারগঞ্জ'], ['Melandaha', 'মেলান্দহ'],
    ['Sarishabari', 'সরিষাবাড়ী']
  ],
  Netrokona: [
    ['Atpara', 'আটপাড়া'], ['Barhatta', 'বারহাট্টা'], ['Durgapur', 'দুর্গাপুর'],
    ['Khaliajuri', 'খালিয়াজুরী'], ['Kalmakanda', 'কলমাকান্দা'], ['Kendua', 'কেন্দুয়া'],
    ['Madan', 'মদন'], ['Mohanganj', 'মোহনগঞ্জ'], ['Netrokona Sadar', 'নেত্রকোণা সদর'],
    ['Purbadhala', 'পূর্বধলা']
  ],
  Sherpur: [
    ['Jhenaigati', 'ঝিনাইগাতী'], ['Nakla', 'নকলা'], ['Nalitabari', 'নালিতাবাড়ী'],
    ['Sherpur Sadar', 'শেরপুর সদর'], ['Sreebardi', 'শ্রীবরদী']
  ],

  // SYLHET DIVISION (41)
  Sylhet: [
    ['Balaganj', 'বালাগঞ্জ'], ['Beanibazar', 'বিয়ানীবাজার'], ['Bishwanath', 'বিশ্বনাথ'],
    ['Companiganj', 'কোম্পানীগঞ্জ'], ['Dakshin Surma', 'দক্ষিণ সুরমা'], ['Fenchuganj', 'ফেঞ্চুগঞ্জ'],
    ['Golapganj', 'গোলাপগঞ্জ'], ['Gowainghat', 'গোয়াইনঘাট'], ['Jaintiapur', 'জৈন্তাপুর'],
    ['Kanaighat', 'কানাইঘাট'], ['Osmani Nagar', 'ওসমানী নগর'], ['Sylhet Sadar', 'সিলেট সদর'],
    ['Zakiganj', 'জকিগঞ্জ']
  ],
  Moulvibazar: [
    ['Barlekha', 'বড়লেখা'], ['Juri', 'জুড়ী'], ['Kamalganj', 'কমলগঞ্জ'],
    ['Kulaura', 'কুলাউড়া'], ['Moulvibazar Sadar', 'মৌলভীবাজার সদর'], ['Rajnagar', 'রাজনগর'],
    ['Sreemangal', 'শ্রীমঙ্গল']
  ],
  Habiganj: [
    ['Ajmiriganj', 'আজমিরীগঞ্জ'], ['Bahubal', 'বাহুবল'], ['Baniyachong', 'বানিয়াচং'],
    ['Chunarughat', 'চুনারুঘাট'], ['Habiganj Sadar', 'হবিগঞ্জ সদর'], ['Lakhai', 'লাখাই'],
    ['Madhabpur', 'মাধবপুর'], ['Nabiganj', 'নবীগঞ্জ'], ['Sayestaganj', 'শায়েস্তাগঞ্জ']
  ],
  Sunamganj: [
    ['Bishwamvarpur', 'বিশ্বম্ভরপুর'], ['Chhatak', 'ছাতক'], ['Derai', 'দিরাই'],
    ['Dharamapasha', 'ধর্মপাশা'], ['Dowarabazar', 'দোয়ারাবাজার'], ['Jagannathpur', 'জগন্নাথপুর'],
    ['Jamalganj', 'জামালগঞ্জ'], ['Sullah', 'শাল্লা'], ['Sunamganj Sadar', 'সুনামগঞ্জ সদর'],
    ['Shanthiganj', 'শান্তিগঞ্জ'], ['Tahirpur', 'তাহিরপুর'], ['Madhyanagar', 'মধ্যনগর']
  ],

  // KHULNA DIVISION (59)
  Khulna: [
    ['Batiaghata', 'বটিয়াঘাটা'], ['Dacope', 'দাকোপ'], ['Dumuria', 'ডুমুরিয়া'],
    ['Dighalia', 'দিঘলিয়া'], ['Koyra', 'কয়রা'], ['Paikgachha', 'পাইকগাছা'],
    ['Phultala', 'ফুলতলা'], ['Rupsha', 'রূপসা'], ['Terokhada', 'তেরখাদা']
  ],
  Jashore: [
    ['Abhaynagar', 'অভয়নগর'], ['Bagherpara', 'বাঘারপাড়া'], ['Chaugachha', 'চৌগাছা'],
    ['Jhikargachha', 'ঝিকরগাছা'], ['Keshabpur', 'কেশবপুর'], ['Jashore Sadar', 'যশোর সদর'],
    ['Manirampur', 'মণিরামপুর'], ['Sharsha', 'শার্শা']
  ],
  Satkhira: [
    ['Assasuni', 'আশাশুনি'], ['Debhata', 'দেবহাটা'], ['Kalaroa', 'কলারোয়া'],
    ['Kaliganj', 'কালীগঞ্জ'], ['Satkhira Sadar', 'সাতক্ষীরা সদর'], ['Shyamnagar', 'শ্যামনগর'],
    ['Tala', 'তালা']
  ],
  Bagerhat: [
    ['Bagerhat Sadar', 'বাগেরহাট সদর'], ['Chitalmari', 'চিতলমারী'], ['Fakirhat', 'ফকিরহাট'],
    ['Kachua', 'কচুয়া'], ['Mollahat', 'মোল্লাহাট'], ['Mongla', 'মোংলা'],
    ['Morrelganj', 'মোড়েলগঞ্জ'], ['Rampal', 'রামপাল'], ['Sarankhola', 'শরণখোলা']
  ],
  Kushtia: [
    ['Bheramara', 'ভেড়ামারা'], ['Daulatpur', 'দৌলতপুর'], ['Khoksa', 'খোকসা'],
    ['Kumarkhali', 'কুমারখালী'], ['Kushtia Sadar', 'কুষ্টিয়া সদর'], ['Mirpur', 'মিরপুর']
  ],
  Jhenaidah: [
    ['Harinakunda', 'হরিণাকুণ্ডু'], ['Jhenaidah Sadar', 'ঝিনাইদহ সদর'], ['Kaliganj', 'কালীগঞ্জ'],
    ['Kotchandpur', 'কোটচাঁদপুর'], ['Maheshpur', 'মহেশপুর'], ['Shailkupa', 'শৈলকূপা']
  ],
  Magura: [
    ['Magura Sadar', 'মাগুরা সদর'], ['Mohammadpur', 'মোহাম্মদপুর'], ['Shalikha', 'শালিখা'],
    ['Sreepur', 'শ্রীপুর']
  ],
  Narail: [
    ['Kalia', 'কালিয়া'], ['Lohagara', 'লোহাগাড়া'], ['Narail Sadar', 'নড়াইল সদর']
  ],
  Chuadanga: [
    ['Alamdanga', 'আলমডাঙ্গা'], ['Chuadanga Sadar', 'চুয়াডাঙ্গা সদর'], ['Damurhuda', 'দামুড়হুদা'],
    ['Jibannagar', 'জীবননগর']
  ],
  Meherpur: [
    ['Gangni', 'গাংনী'], ['Meherpur Sadar', 'মেহেরপুর সদর'], ['Mujibnagar', 'মুজিবনগর']
  ],

  // BARISHAL DIVISION (42)
  Barishal: [
    ['Agailjhara', 'আগৈলঝাড়া'], ['Babuganj', 'বাবুগঞ্জ'], ['Bakerganj', 'বাকেরগঞ্জ'],
    ['Banaripara', 'বানারীপাড়া'], ['Gaurnadi', 'গৌরনদী'], ['Hizla', 'হিজলা'],
    ['Barishal Sadar', 'বরিশাল সদর'], ['Mehendiganj', 'মেহেন্দীগঞ্জ'], ['Muladi', 'মুলাদী'],
    ['Wazirpur', 'উজিরপুর']
  ],
  Patuakhali: [
    ['Bauphal', 'বাউফল'], ['Dashmina', 'দশমিনা'], ['Galachipa', 'গলাচিপা'],
    ['Kalapara', 'কলাপাড়া'], ['Mirzaganj', 'মির্জাগঞ্জ'], ['Patuakhali Sadar', 'পটুয়াখালী সদর'],
    ['Rangabali', 'রাঙ্গাবালী'], ['Dumki', 'দুমকি']
  ],
  Bhola: [
    ['Bhola Sadar', 'ভোলা সদর'], ['Burhanuddin', 'বোরহানউদ্দিন'], ['Char Fasson', 'চরফ্যাশন'],
    ['Daulatkhan', 'দৌলতখান'], ['Lalmohan', 'লালমোহন'], ['Manpura', 'মনপুরা'],
    ['Tazumuddin', 'তজুমদ্দিন']
  ],
  Pirojpur: [
    ['Bhandaria', 'ভাণ্ডারিয়া'], ['Kawkhali', 'কাউখালী'], ['Mathbaria', 'মঠবাড়িয়া'],
    ['Nazirpur', 'নাজিরপুর'], ['Pirojpur Sadar', 'পিরোজপুর সদর'], ['Nesarabad', 'নেছারাবাদ'],
    ['Indurkani', 'ইন্দুরকানী']
  ],
  Barguna: [
    ['Amtali', 'আমতলী'], ['Bamna', 'বামনা'], ['Barguna Sadar', 'বরগুনা সদর'],
    ['Betagi', 'বেতাগী'], ['Patharghata', 'পাথরঘাটা'], ['Taltali', 'তালতলী']
  ],
  Jhalakathi: [
    ['Jhalakathi Sadar', 'ঝালকাঠি সদর'], ['Kanthalia', 'কাঠালিয়া'], ['Nalchhiti', 'নলছিটি'],
    ['Rajapur', 'রাজাপুর']
  ],
};

export function buildUpazilasDataset() {
  let rootDir = process.cwd();
  if (!fs.existsSync(path.resolve(rootDir, 'bangladesh_police_stations.json'))) {
    const parent = path.resolve(rootDir, '../..');
    if (fs.existsSync(path.resolve(parent, 'bangladesh_police_stations.json'))) {
      rootDir = parent;
    }
  }

  const policeStationsPath = path.resolve(rootDir, 'bangladesh_police_stations.json');
  let policeStations: any[] = [];
  if (fs.existsSync(policeStationsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(policeStationsPath, 'utf8'));
      policeStations = data.stations || [];
    } catch {}
  }

  // Load District Centers as fallback coordinates
  const districtCentersPath = path.resolve(rootDir, 'tests/e2e/harness/testDataGenerators.ts');
  const districtCenters: Record<string, { latitude: number; longitude: number }> = {};
  if (fs.existsSync(districtCentersPath)) {
    const content = fs.readFileSync(districtCentersPath, 'utf8');
    const match = content.match(/export const DISTRICT_CENTERS: Record<string, { latitude: number; longitude: number }> = {([\s\S]*?)};/);
    if (match) {
      const lines = match[1].split(/\r?\n/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith('//') || !line.includes('{')) continue;
        const lineMatch = line.match(/^(?:"([^"]+)"|'([^']+)'|([a-zA-Z\s'-]+))\s*:\s*{\s*latitude:\s*([\d.]+),\s*longitude:\s*([\d.]+)\s*}/);
        if (lineMatch) {
          const dist = (lineMatch[1] || lineMatch[2] || lineMatch[3]).trim();
          if (dist) {
            districtCenters[dist] = {
              latitude: parseFloat(lineMatch[4]),
              longitude: parseFloat(lineMatch[5]),
            };
          }
        }
      }
    }
  }

  // Ensure all 64 districts are present and verify key centers
  const REQUIRED_KEY_DISTRICTS = [
    "Cox's Bazar",
    'Chattogram',
    'Rajshahi',
    'Khulna',
    'Barishal',
    'Sylhet',
    'Rangpur',
    'Mymensingh',
    'Dhaka',
  ];
  for (const kd of REQUIRED_KEY_DISTRICTS) {
    if (!districtCenters[kd]) {
      throw new Error(`CRITICAL: District center for '${kd}' was not extracted from ${districtCentersPath}`);
    }
  }
  if (Object.keys(districtCenters).length < 64) {
    throw new Error(`CRITICAL: Expected 64 districts in districtCenters, found ${Object.keys(districtCenters).length}`);
  }

  const upazilaRecords: any[] = [];
  let totalCount = 0;

  for (const [districtEn, upazilaList] of Object.entries(UPAZILAS_DEF)) {
    const districtBn = DISTRICT_NAMES_BN[districtEn] || districtEn;
    const divisionEn = DISTRICT_TO_DIV[districtEn] || 'Dhaka';
    const divisionBn = DIVISION_NAMES_BN[divisionEn] || divisionEn;
    const distCenter = districtCenters[districtEn] || { latitude: 23.8103, longitude: 90.4125 };

    let uIdx = 0;
    for (const [nameEn, nameBn] of upazilaList) {
      totalCount++;
      const id = `${districtEn.toLowerCase().replace(/[^a-z0-9]/g, '')}-${nameEn.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      // Try matching police station coordinates
      let lat: number | null = null;
      let lng: number | null = null;

      const normName = nameEn.toLowerCase().replace(/\s*sadar$/i, '');
      const matchedStation = policeStations.find((s) => {
        if (s.district.toLowerCase() !== districtEn.toLowerCase()) return false;
        const sName = (s.station_name_en || '').toLowerCase();
        return sName.includes(normName) && s.location && s.location.latitude !== null;
      });

      if (matchedStation && matchedStation.location && matchedStation.location.latitude) {
        lat = Number(matchedStation.location.latitude.toFixed(4));
        lng = Number(matchedStation.location.longitude.toFixed(4));
      } else {
        // Deterministic offset around district center
        const angle = (uIdx / upazilaList.length) * 2 * Math.PI;
        const radius = 0.08 + (uIdx % 3) * 0.04; // ~8km to 16km
        lat = Number((distCenter.latitude + Math.sin(angle) * radius).toFixed(4));
        lng = Number((distCenter.longitude + Math.cos(angle) * radius).toFixed(4));
      }

      uIdx++;

      const aliasesEn = [nameEn, `${nameEn} Upazila`, `${nameEn} Thana`];
      const aliasesBn = [nameBn, `${nameBn} উপজেলা`, `${nameBn} থানা`];

      if (id === 'coxsbazar-chakaria') {
        if (!aliasesBn.includes('চকরিয়া')) aliasesBn.push('চকরিয়া');
        if (!aliasesBn.includes('চকরিয়া উপজেলা')) aliasesBn.push('চকরিয়া উপজেলা');
        if (!aliasesBn.includes('চকরিয়া থানা')) aliasesBn.push('চকরিয়া থানা');
      }

      upazilaRecords.push({
        id,
        nameEn,
        nameBn,
        districtEn,
        districtBn,
        divisionEn,
        divisionBn,
        latitude: lat,
        longitude: lng,
        aliasesEn,
        aliasesBn,
      });
    }
  }

  const outputPath = path.resolve(rootDir, 'apps/api/src/data/bangladesh_upazilas.json');
  fs.writeFileSync(outputPath, JSON.stringify(upazilaRecords, null, 2), 'utf8');
  console.log(`Generated ${upazilaRecords.length} upazilas to ${outputPath}`);
}

buildUpazilasDataset();
