import playerUrl from "../assets/characters/player.png";
import familyUrl from "../assets/characters/family.png";
import schoolCoreUrl from "../assets/characters/school-core.png";
import studentsAUrl from "../assets/characters/students-a.png";
import studentsBUrl from "../assets/characters/students-b.png";
import medicalStaffUrl from "../assets/characters/medical-staff.png";
import patientsUrl from "../assets/characters/patients.png";
import cashierUrl from "../assets/characters/cashier.png";
import stockClerkUrl from "../assets/characters/stock-clerk.png";
import floorClerkUrl from "../assets/characters/floor-clerk.png";
import customer1Url from "../assets/characters/customer-1.png";
import customer2Url from "../assets/characters/customer-2.png";
import customer3Url from "../assets/characters/customer-3.png";
import customer4Url from "../assets/characters/customer-4.png";

const composite = (textureKey, url, panel) => ({ textureKey, url, panel, columns: 4, rows: 3, panelColumns: 2, panelRows: 2 });
const individual = (textureKey, url) => ({ textureKey, url, columns: 4, rows: 4, panelColumns: 1, panelRows: 1 });

export const CHARACTER_SHEETS = {
  "character-player": playerUrl,
  "character-family": familyUrl,
  "character-school-core": schoolCoreUrl,
  "character-students-a": studentsAUrl,
  "character-students-b": studentsBUrl,
  "character-medical-staff": medicalStaffUrl,
  "character-patients": patientsUrl,
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
  mother: composite("character-family", familyUrl, 0),
  father: composite("character-family", familyUrl, 1),
  grandfather: composite("character-family", familyUrl, 2),
  grandmother: composite("character-family", familyUrl, 3),
  brother: composite("character-school-core", schoolCoreUrl, 0),
  "duty-teacher": composite("character-school-core", schoolCoreUrl, 1),
  "lin-teacher": composite("character-school-core", schoolCoreUrl, 2),
  "student-1": composite("character-school-core", schoolCoreUrl, 3),
  "student-2": composite("character-students-a", studentsAUrl, 0),
  "student-3": composite("character-students-a", studentsAUrl, 1),
  "student-4": composite("character-students-a", studentsAUrl, 2),
  "student-5": composite("character-students-a", studentsAUrl, 3),
  "student-6": composite("character-students-b", studentsBUrl, 0),
  "student-7": composite("character-students-b", studentsBUrl, 1),
  "student-8": composite("character-students-b", studentsBUrl, 2),
  "student-9": composite("character-students-b", studentsBUrl, 3),
  "student-10": composite("character-medical-staff", medicalStaffUrl, 0),
  "guide-nurse": composite("character-medical-staff", medicalStaffUrl, 1),
  "chen-nurse": composite("character-medical-staff", medicalStaffUrl, 2),
  "wang-doctor": composite("character-medical-staff", medicalStaffUrl, 3),
  "patient-1": composite("character-patients", patientsUrl, 0),
  "patient-2": composite("character-patients", patientsUrl, 1),
  "patient-3": composite("character-patients", patientsUrl, 2),
  "patient-4": composite("character-patients", patientsUrl, 3),
  cashier: individual("character-cashier", cashierUrl),
  "stock-clerk": individual("character-stock-clerk", stockClerkUrl),
  "floor-clerk": individual("character-floor-clerk", floorClerkUrl),
  "customer-1": individual("character-customer-1", customer1Url),
  "customer-2": individual("character-customer-2", customer2Url),
  "customer-3": individual("character-customer-3", customer3Url),
  "customer-4": individual("character-customer-4", customer4Url),
};

export function characterFrame(characterId, direction = 0, walkFrame = 0) {
  const character = CHARACTERS[characterId];
  const sourceRow = character.rows === 3 && direction === 2 ? 1 : direction === 3 ? character.rows - 1 : direction;
  return `${characterId}:${sourceRow}:${walkFrame}`;
}

export function characterFlipsHorizontally(characterId, direction) {
  return CHARACTERS[characterId].rows === 3 && direction === 2;
}

export function characterPortrait(characterId) {
  const character = CHARACTERS[characterId];
  const panel = character.panel ?? 0;
  const panelX = panel % character.panelColumns;
  const panelY = Math.floor(panel / character.panelColumns);
  const columns = character.columns * character.panelColumns;
  const rows = character.rows * character.panelRows;
  return {
    url: character.url,
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
    backgroundPosition: `${(panelX * character.columns) * 100 / Math.max(1, columns - 1)}% ${(panelY * character.rows) * 100 / Math.max(1, rows - 1)}%`,
  };
}
