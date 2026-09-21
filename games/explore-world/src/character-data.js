import playerUrl from "../assets/characters/player.png";
import motherUrl from "../assets/characters/mother.png";
import fatherUrl from "../assets/characters/father.png";
import grandfatherUrl from "../assets/characters/grandfather.png";
import grandmotherUrl from "../assets/characters/grandmother.png";
import brotherUrl from "../assets/characters/brother.png";
import dutyTeacherUrl from "../assets/characters/duty-teacher.png";
import linTeacherUrl from "../assets/characters/lin-teacher.png";
import student1Url from "../assets/characters/student-1.png";
import student2Url from "../assets/characters/student-2.png";
import student3Url from "../assets/characters/student-3.png";
import student4Url from "../assets/characters/student-4.png";
import student5Url from "../assets/characters/student-5.png";
import student6Url from "../assets/characters/student-6.png";
import student7Url from "../assets/characters/student-7.png";
import student8Url from "../assets/characters/student-8.png";
import student9Url from "../assets/characters/student-9.png";
import student10Url from "../assets/characters/student-10.png";
import guideNurseUrl from "../assets/characters/guide-nurse.png";
import chenNurseUrl from "../assets/characters/chen-nurse.png";
import wangDoctorUrl from "../assets/characters/wang-doctor.png";
import patient1Url from "../assets/characters/patient-1.png";
import patient2Url from "../assets/characters/patient-2.png";
import patient3Url from "../assets/characters/patient-3.png";
import patient4Url from "../assets/characters/patient-4.png";
import cashierUrl from "../assets/characters/cashier.png";
import stockClerkUrl from "../assets/characters/stock-clerk.png";
import floorClerkUrl from "../assets/characters/floor-clerk.png";
import customer1Url from "../assets/characters/customer-1.png";
import customer2Url from "../assets/characters/customer-2.png";
import customer3Url from "../assets/characters/customer-3.png";
import customer4Url from "../assets/characters/customer-4.png";

const individual = (textureKey, url) => ({ textureKey, url, columns: 4, rows: 4, panelColumns: 1, panelRows: 1 });

export const CHARACTER_SHEETS = {
  "character-player": playerUrl,
  "character-mother": motherUrl, "character-father": fatherUrl, "character-grandfather": grandfatherUrl, "character-grandmother": grandmotherUrl,
  "character-brother": brotherUrl, "character-duty-teacher": dutyTeacherUrl, "character-lin-teacher": linTeacherUrl,
  "character-student-1": student1Url, "character-student-2": student2Url, "character-student-3": student3Url, "character-student-4": student4Url, "character-student-5": student5Url,
  "character-student-6": student6Url, "character-student-7": student7Url, "character-student-8": student8Url, "character-student-9": student9Url, "character-student-10": student10Url,
  "character-guide-nurse": guideNurseUrl, "character-chen-nurse": chenNurseUrl, "character-wang-doctor": wangDoctorUrl,
  "character-patient-1": patient1Url, "character-patient-2": patient2Url, "character-patient-3": patient3Url, "character-patient-4": patient4Url,
  "character-cashier": cashierUrl,
  "character-stock-clerk": stockClerkUrl,
  "character-floor-clerk": floorClerkUrl,
  "character-customer-1": customer1Url,
  "character-customer-2": customer2Url,
  "character-customer-3": customer3Url,
  "character-customer-4": customer4Url,
};

export const CHARACTERS = {
  player: individual("character-player", playerUrl),
  mother: individual("character-mother", motherUrl), father: individual("character-father", fatherUrl),
  grandfather: individual("character-grandfather", grandfatherUrl), grandmother: individual("character-grandmother", grandmotherUrl),
  brother: individual("character-brother", brotherUrl), "duty-teacher": individual("character-duty-teacher", dutyTeacherUrl),
  "lin-teacher": individual("character-lin-teacher", linTeacherUrl), "student-1": individual("character-student-1", student1Url),
  "student-2": individual("character-student-2", student2Url), "student-3": individual("character-student-3", student3Url),
  "student-4": individual("character-student-4", student4Url), "student-5": individual("character-student-5", student5Url),
  "student-6": individual("character-student-6", student6Url), "student-7": individual("character-student-7", student7Url),
  "student-8": individual("character-student-8", student8Url), "student-9": individual("character-student-9", student9Url),
  "student-10": individual("character-student-10", student10Url), "guide-nurse": individual("character-guide-nurse", guideNurseUrl),
  "chen-nurse": individual("character-chen-nurse", chenNurseUrl), "wang-doctor": individual("character-wang-doctor", wangDoctorUrl),
  "patient-1": individual("character-patient-1", patient1Url), "patient-2": individual("character-patient-2", patient2Url),
  "patient-3": individual("character-patient-3", patient3Url), "patient-4": individual("character-patient-4", patient4Url),
  cashier: individual("character-cashier", cashierUrl),
  "stock-clerk": individual("character-stock-clerk", stockClerkUrl),
  "floor-clerk": individual("character-floor-clerk", floorClerkUrl),
  "customer-1": individual("character-customer-1", customer1Url),
  "customer-2": individual("character-customer-2", customer2Url),
  "customer-3": individual("character-customer-3", customer3Url),
  "customer-4": individual("character-customer-4", customer4Url),
};

export function characterFrame(characterId, direction = 0, walkFrame = 0) {
  return direction * 4 + walkFrame;
}

export function characterFlipsHorizontally() { return false; }

export function characterPortrait(characterId) {
  const character = CHARACTERS[characterId];
  return {
    url: character.url,
    backgroundSize: "400% 400%",
    backgroundPosition: "0% 0%",
  };
}
