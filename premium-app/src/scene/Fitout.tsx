// The rest of the Synty POLYGON Office pack: restrooms, the small things that make each room lived-in,
// the outside of the building, and (only when walking around inside) the ceiling.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useOffice } from '../store/useOffice';
import { Prop } from './assets';
import { insideView } from './inside';
import { ROOMS, PIECE, MEETING_TABLE, KITCHEN_ISLAND, RECEPTION, LOBBY_SOFA, POOL_TABLES, FOOSBALL, SOFA, TABLE_TENNIS, roomAt } from '../world/layout';

const H = Math.PI / 2, P = Math.PI;
/** [model, x, y, z, rotY?, scale?, rotX?] */
type Item = [string, number, number, number, number?, number?, number?];
const Items = ({ list }: { list: Item[] }) => (
  <>{list.map(([n, x, y, z, r = 0, s = 1, rx = 0], i) => <Prop key={i} name={n} position={[x, y, z]} rotation={[rx, r, 0]} scale={s} />)}</>
);

// ------------------------------------------------------------------ restrooms (women's x -2.5..0, men's x 0..2.5, z 10..15)
const RESTROOMS: Item[] = [
  // women's: two stalls at the back, vanity on the west wall
  ['ToiletStalls_01', -2.25, 0, 14.85, P], ['Toilet_01', -0.71, 0, 14.85, P], ['Toilet_01', -1.75, 0, 14.85, P],
  ['Toilet_Paper_01', -0.35, 0.7, 14.85, P], ['Toilet_Paper_02', -1.35, 0.85, 14.85, P],
  ['Bathroom_Sink_01', -2.5, 0, 12.9, H], ['Bathroom_Mirror_01', -2.48, 0, 12.9, H], ['Bathroom_Light_01', -2.48, 2.95, 12.9, H],
  ['Soap_Dispenser_01', -2.5, 1.0, 13.05, H], ['Flowers_02', -2.1, 0.95, 10.6, 0.4],
  ['HandDryer_02', 0, 1.25, 10.7, -H], ['PaperTowel_Dispenser_01', -0.3, 1.3, 10.0], ['Bin_03', -0.35, 0, 10.45],
  ['Sign_Toilets_Female_01', -1.25, 2.3, 9.84, P], ['Sign_Toilets_Disabled_01', -2.15, 1.6, 9.84, P],
  // men's: urinals on the east wall, vanity on the divider, stalls at the back
  ['ToiletStalls_01', 0.3, 0, 14.85, P], ['Toilet_01', 0.8, 0, 14.85, P], ['Toilet_01', 1.84, 0, 14.85, P],
  ['Toilet_Paper_01', 1.2, 0.7, 14.85, P], ['Toilet_Paper_01', 2.2, 0.7, 14.85, P], ['Sign_OutofOrder_01', 1.84, 1.35, 13.28, P],
  ['Bathroom_Sink_02', 0.15, 0, 12.9, H], ['Bathroom_Mirror_01', 0.17, 0, 12.9, H], ['Bathroom_Light_01', 0.17, 2.95, 12.9, H],
  ['Soap_Dispenser_01', 0.15, 1.0, 13.05, H], ['Urinal_02', 2.5, 0, 11.7, -H], ['HandDryer_01', 2.2, 0, 10.0], ['Bin_03', 0.55, 0, 13.05],
  ['Sign_Toilets_Male_01', 1.25, 2.3, 9.84, P],
  // lounge side: a sign and a little shelf on the restroom wall
  ['Sign_Toilets_02', -2.66, 2.1, 12.6, -H], ['Shelf_Wall_01', -2.82, 1.4, 11.25, -H],
  ['Plant_09', -2.82, 1.44, 10.85], ['Book_Group_07', -2.82, 1.68, 11.4, -H], ['Plant_11', -2.82, 1.93, 11.2],
];

// ------------------------------------------------------------------ rooms
const k = KITCHEN_ISLAND, t = MEETING_TABLE, r = RECEPTION, P1 = POOL_TABLES[1];
const KITCHEN: Item[] = [
  ['Kitchen_CounterSink_Dishes_01', -19.95, 0, 0, H], ['Kettle_01_Base_01', -19.45, 0.95, 0.9, H], ['Knife_Holder_01', -19.6, 0.95, -0.9, H],
  ['Blender_01', -19.5, 0.95, 1.3, H], ['Toaster_02', -19.5, 0.95, 2.05, H], ['Container_01', -19.55, 0.95, -0.15], ['PaperRoll_01', -19.55, 0.95, 2.9],
  ['Pan_01', -19.4, 0.96, 0.45, H], ['Knife_Holder_02', -18.9, 1.1, 4.98, P],
  // mug shelf by the fridge
  ['Shelf_Wall_02', -18.75, 1.5, 4.98, P], ['Cup_01', -19.3, 1.5, 4.76], ['Cup_02', -18.9, 1.5, 4.76], ['Cup_03', -18.5, 1.5, 4.76],
  ['Dishes_03', -19.4, 1.83, 4.74], ['Dishes_04', -18.9, 1.83, 4.74], ['Milk_01', -18.3, 2.16, 4.74], ['Plant_11', -19.3, 2.16, 4.74],
  // island
  ['ChoppingBoard_02', k.x + 0.05, 0.95, k.z + 0.65], ['Sandwich_02', k.x + 0.05, 0.98, k.z + 0.65], ['Dishes_01', k.x - 0.55, 0.95, k.z - 0.75],
  ['Toast_01', k.x - 0.55, 0.98, k.z - 0.75], ['Toast_02', k.x - 0.5, 0.99, k.z - 0.7, 0.6], ['Dishes_02', k.x + 0.2, 0.95, k.z - 0.8],
  ['Toast_03', k.x + 0.2, 0.98, k.z - 0.8], ['Dishes_03', k.x - 0.7, 0.95, k.z + 0.75], ['Dishes_04', k.x + 0.75, 0.95, k.z + 0.85],
  ['Napkins_01', k.x + 0.85, 0.95, k.z - 0.75], ['Lunchbox_Plastic_01', k.x - 0.85, 0.95, k.z + 0.05, 0.4], ['Pot_01', k.x + 0.1, 0.95, k.z + 0.05, 0, 0.7],
  ['ChoppingBoard_01', k.x - 0.15, 0.95, k.z - 0.15, 0.3, 0.6], ['Milk_Claimed_01', k.x + 0.85, 0.95, k.z + 0.3],
  // walls
  ['Blackboard_01', -10.03, 1.7, -0.9, -H], ['Darkboard_01', -10.03, 1.6, 3.4, -H], ['AirVent_Wall_01', -14.0, 2.6, 4.98, P],
];

const MEETING: Item[] = [
  ['Projector_02', t.x - 0.45, 0.75, t.z + 0.1, P], ['Projector_01_Angled', t.x + 1.75, 0.75, t.z - 0.6, P],
  ['Laptop_Folding_01', t.x - 0.5, 0.75, t.z + 0.6, P], ['Laptop_Folding_02', t.x + 0.6, 0.75, t.z - 0.6],
  ['NotePad_02', t.x + 0.85, 0.75, t.z + 0.4], ['Pen_02', t.x + 0.9, 0.76, t.z + 0.4, 0.3, 1, H],
  ['Pen_04', t.x - 1.0, 0.76, t.z - 0.2, 1.2, 1, H], ['Pen_05', t.x + 0.2, 0.76, t.z + 0.3, 2.1, 1, H],
  ['Donut_Choc_01', t.x + 1.3, 0.75, t.z + 0.55], ['Donut_Cream_01', t.x + 1.45, 0.75, t.z + 0.72],
  ['Bottle_01', t.x - 1.6, 0.75, t.z - 0.3], ['Bottle_01', t.x + 0.4, 0.75, t.z - 0.75], ['Socket_Floor_01', t.x, 0.0, t.z + 1.4],
  ['OHP_01', -11.2, 0.75, -9.6, -H], ['ProjectorScreen_01', -10.03, 1.8, -12.0, -H], ['ProjectorScreen_02_Up', -19.8, 3.0, -10.3, H],
  ['WallDressing_Clean_01', -10.03, 1.0, -8.0, -H], ['Coffee_Tray_01', -19.62, 0.89, -8.35, H],
];

const MANAGER: Item[] = [
  ['Chair_02', -7.95, 0, -8.6, H], ['Chair_02', -7.95, 0, -6.6, H], ['Chair_02', -5.25, 0, -8.6, -H], ['Chair_02', -5.25, 0, -6.6, -H],
  ['Folder_Manila_02', -6.4, 0.91, -8.2, 0.3], ['Cup_Saucer_03', -6.9, 0.91, -7.0], ['Cup_02', -6.9, 0.92, -7.0], ['Calculator_02', -6.3, 0.91, -6.6, 0.2],
  ['Typewriter_01', -9.4, 0.76, -11.35, H], ['Phone_Rotary_01', -9.45, 0.76, -11.8, H],
  ['Alcohol_Bottle_01', -4.6, 0.53, -6.75], ['Alcohol_Glass_01', -4.95, 0.53, -6.7], ['Alcohol_Glass_01', -4.85, 0.53, -7.3],
  ['NamePlate_01', -6.55, 0.75, -10.82], ['Cup_Saucer_03', -5.75, 0.75, -10.95],
  ['Projector_01', -6.6, 0.91, -7.6, P], ['LaptopStand_01', -6.6, 0.91, -6.4, H], ['Pen_03', -6.2, 0.92, -8.0, 0.4, 1, H], ['Pencil_02', -6.25, 0.92, -8.1, 0.9, 1, H],
];

const STUDIO: Item[] = [
  ['Computer_Setup_02', 3.6, 0.75, -8.0, -H], ['Chair_01', 2.1, 0, -8.0, H], ['GraphicsTablet_04', 3.3, 0.75, -7.4, -H],
  ['GraphicsTablet_StylusStand_01', 2.85, 0.75, -7.3], ['GraphicsTablet_Stylus_01', 2.95, 0.76, -7.55], ['Microphone_03', 2.9, 0.75, -8.6, -H],
  ['Microphone_02', 0.7, 0, -12.0, P], ['Cord_01', 2.0, 0, -10.8], ['GreenScreen_02', 1.25, 0.01, -12.9, H],
  ['ProjectorScreen_02_Down', 4.95, 3.0, -12.6, -H], ['Shelf_Wall_03', 4.98, 1.9, -8.6, -H],
  ['Headphones_02', 4.75, 1.9, -8.9, -H], ['HDD_Dock_01', 4.75, 1.9, -8.3, -H],
  ['CorkBoard_02', -2.2, 0.38, -7.6, H], ['Divider_Folding_01_Preset', -1.9, 0, -10.2, H],
  ['CableTray_01_Long', 4.3, 2.7, -13.6], ['CableTray_01_Curve', 4.3, 2.7, -7.3],
  ['CableTray_01_Cable_End_02', 1.3, 2.7, -13.6],
  ['Keypad_01', 1.3, 1.2, -4.99],
];

const SERVER: Item[] = [
  // supply rack (Shelf_03 at 9.7, -11.0; shelves at 0.43, 0.93, 1.43, top 1.93)
  ['Server_Node_01', 9.7, 0.43, -11.0, -H], ['Server_Node_02', 9.7, 0.93, -11.0, -H], ['Server_Node_03', 9.7, 1.43, -11.25, -H],
  ['Modem_01', 9.7, 1.43, -10.75, -H], ['Modem_03', 9.7, 1.93, -11.2, -H], ['Modem_04', 9.7, 1.93, -10.75, -H],
  ['Modem_02', 5.55, 0.82, -11.0, H], ['NetCable_01', 8.6, 0.93, -6.6], ['NetCable_03', 9.0, 0.93, -6.6], ['HDD_01', 8.8, 0.93, -6.4],
  ['NetCable_02', 7.5, 0, -11.6], ['Box_01', 5.6, 0.23, -13.8], ['CardboardBox_05', 6.4, 0.23, -13.8, 0.4],
  ['Wall_Electronics_01', 5.16, 0.3, -8.2, H], ['Aircon_01', 9.98, 2.85, -11.0, -H], ['AirVent_01', 5.16, 2.3, -13.6, H],
  // janitor's corner
  ['Mop_02', 8.35, 0.86, -5.45, 0, 1, 0.12], ['Broom_01', 9.85, 0.52, -6.3, 0, 1, 0.15], ['SprayBottle_01', 9.35, 1.07, -5.5], ['Bucket_02', 7.9, 0, -5.6],
  // cable trays and ducts above the racks
  ['CableTray_01_Short', 9.45, 2.25, -9.5], ['CableTray_01_ShortHalf', 7.45, 2.25, -9.5], ['CableTray_01_Cable_End_01', 6.45, 2.25, -9.5],
  ['CableTray_01_Tee', 9.9, 2.25, -12.5], ['CableTray_01_Curve_Reverse', 9.9, 2.25, -7.5], ['Ducting_01_Long', 9.95, 2.3, -13.6], ['Ducting_01_Short_Vent', 6.95, 2.3, -13.6],
  ['Card_Scanner_01', 7.05, 1.2, -4.99],
];

const GAME: Item[] = [
  // retro corner: CRT, joysticks, VHS
  ['Monitor_Crt_01', 10.75, 0.75, -13.9, H], ['Joystick_01', 11.1, 0.75, -13.4], ['Joystick_02', 11.1, 0.75, -13.0],
  ['Speaker_Bluetooth_02', 10.55, 0.75, -12.85, H], ['VCR_01', 10.75, 0.75, -14.4, H], ['VHS_Tape_01', 11.15, 0.75, -14.3, 0.3],
  ['Cd_01', 11.2, 0.75, -13.75], ['Dvd_01', 11.25, 0.76, -13.85, 0.5], ['Chair_09', 11.85, 0, -13.6, -H],
  // toy blasters on the wall
  ['SM_Wep_ToyGun_Rifle_01', 10.22, 2.05, -13.6], ['SM_Wep_ToyGun_SMG_01', 10.22, 1.65, -14.0],
  ['SM_Wep_ToyGun_Shotgun_01', 10.22, 1.65, -13.15], ['SM_Wep_ToyGun_OneShot_01', 10.22, 1.35, -13.6],
  // consoles
  ['Console_MegaCube_01', 15.95, 0.42, -12.95], ['Controller_01', 15.3, 0.42, -13.0], ['Controller_02', 15.85, 0.42, -13.45],
  // a birthday at the snack table
  ['Cake_01', 11.7, 0.75, -6.7], ['Cord_Wall_01', 16.8, 0, -12.25, P], ['Party_Hat_01', 11.25, 0.75, -7.05], ['Party_Hat_02', 12.15, 0.75, -6.35], ['Party_Hat_03', 11.45, 0.75, -6.2],
  ['Air_Horn_01', 12.05, 0.75, -7.1, 0.5], ['Balloon_01', 12.9, 1.0, -5.8], ['Balloon_02', 10.6, 1.0, -7.8],
  ['Streamer_01', 11.2, 2.95, -6.2], ['Streamer_02', 12.3, 2.95, -7.2],
  ['Bunting_01', 11.4, 2.85, -14.75], ['Bunting_02', 15.9, 2.85, -14.75], ['Bunting_03', 18.6, 2.85, -14.75],
  ['Xmas_Present_01', 10.5, 0, -6.0, 0.3], ['Xmas_Present_05', 10.5, 0.31, -6.0, 0.9], ['Xmas_Present_02', 10.45, 0, -6.65, 0.8],
  ['Xmas_Present_03', 13.05, 0, -7.6, 0.2], ['Xmas_Present_04', 13.1, 0, -5.6, 1.1],
  ['SwissBall_01', 18.6, 0.34, -13.3], ['TableTennis_Ball_01', TABLE_TENNIS.x + 0.3, 0.8, TABLE_TENNIS.z + 0.2],
];

const LOUNGE: Item[] = [
  ['Fishtank_FX_01', -9.35, 0, 3.6, H], ['Fish_01', -9.35, 1.0, 3.3, H], ['Fish_01', -9.3, 1.1, 3.9, -H],
  ['Fish_01', -9.4, 0.9, 3.65, H + 0.3], ['Fish_01', -9.32, 1.05, 3.05, -H + 0.2],
  ['PoolBall_02', P1.x - 0.6, 0.93, P1.z + 0.2], ['PoolBall_03', P1.x + 0.9, 0.93, P1.z - 0.3], ['PoolBall_04', P1.x + 0.2, 0.93, P1.z + 0.4],
  ['TableFootball_Ball_01', FOOSBALL.x, 0.82, FOOSBALL.z], ['Prank_Cushion_01', SOFA.x - 0.5, 0.47, SOFA.z - 0.05, P],
  ['Laptop_02', -3.1, 0.75, 12.6, -H], ['Chair_05', -3.85, 0, 12.5, H], ['Cup_Coffee_Disposable_Open_01', -3.0, 0.75, 13.4],
  ['Pot_Spilled_01', -8.9, 0, 0.9, 0.6], ['CorkBoard_01', 1.9, 0.46, 3.6, -H],
  ['B:FeatureWall_Square_01', -9.98, 0, 0, H], ['B:FeatureWall_Square_02', -9.98, 0, 5, H],
];

const RECEPTION_ITEMS: Item[] = [
  // on the reception desk (see Reception in Office.tsx for its shape)
  ['Sculpture_02', -12.0, 0.31, 12.6], ['Book_Phone_01', r.x - 1.15, 0.75, r.z - 0.7, 0.2],
  ['Phone_Portable_01_Base_01', r.x + 0.85, 0.75, r.z + 0.05, P], ['Phone_Portable_01_Handset_01', r.x + 0.85, 0.76, r.z + 0.05, P],
  ['Jellybeans_01', r.x + 0.75, 0.93, r.z + 0.6], ['Mints_01', r.x + 1.0, 0.93, r.z + 0.6], ['NamePlate_01', r.x + 0.35, 0.93, r.z + 0.6],
  ['CardRoller_01', r.x - 1.15, 0.75, r.z - 0.35], ['ID_Card_01', r.x - 1.0, 0.75, r.z - 0.95, 0.3], ['Card_Reader_01', r.x - 0.35, 0.75, r.z + 0.05, P],
  ['Printer_Mini_01', r.x + 1.25, 0.75, r.z + 0.2, P], ['Flowers_01', LOBBY_SOFA.x + 1.3, 0.89, LOBBY_SOFA.z + 0.35],
  ['Briefcase_03', -18.0, 0, 9.5, 0.4], ['Light_08', -17.3, 2.55, 5.24], ['Light_08', -12.7, 2.55, 5.24],
];

const SECURITY: Item[] = [
  // supply rack (Shelf_03 at 20.42, -13.3; shelves at 0.43, 0.93, 1.43, top 1.93)
  ['Server_Node_01', 20.42, 0.43, -13.3, H], ['Modem_02', 20.42, 0.93, -13.6, H], ['HDD_Dock_01', 20.42, 0.93, -13.0, H],
  ['Server_Node_02', 20.42, 1.43, -13.3, H], ['Folder_Holder_03', 20.42, 1.93, -13.6, H], ['Modem_04', 20.42, 1.93, -13.05, H],
  // on the filing cabinets, by the shredder, on the walls
  ['PaperTray_01_Full_01', 29.58, 1.51, -9.4, -H], ['Printer_Mini_01', 29.58, 1.19, -8.9, -H], ['Bin_01', 20.35, 0, -5.75],
  ['Certificate_01', 20.17, 1.7, -7.9, H], ['Certificate_01', 20.17, 1.7, -7.2, H], ['FireAlarm_Switch_01', 20.17, 1.45, -5.6, H],
  ['Aircon_01', 29.83, 2.85, -6.4, -H], ['Cord_Pile_01', 25.0, 0, -10.6, 0.7], ['Socket_Floor_01', 25.0, 0, -9.75],
];

const CORRIDOR: Item[] = [
  ['Emergency_Axe_01', 9.55, 1.4, -4.98], ['FireAlarm_Switch_01', 10.35, 1.45, -4.98], ['Sign_HR_Dep_01', 18.75, 2.55, -2.53, P],
  ['Card_Scanner_02', 7.05, 1.2, -2.52, P], ['Sign_Toilets_01', -11.25, 2.4, -2.53, P],
];

const WORKSPACE: Item[] = [
  // on the storage cabinets
  ['Printer_3D_01', 19.55, 1.19, 2.9, -H], ['Printer_3D_Toy_01', 19.45, 1.19, 3.25], ['FaxMachine_01', 19.55, 1.51, 3.6, -H], ['Printer_01', 19.55, 1.19, 4.3, -H],
  // supply rack (Shelf_03 at 19.55, 5.8)
  ['Box_01', 19.55, 0.43, 5.5, -H], ['CardboardBox_05', 19.55, 0.43, 6.1, -H], ['Folder_Holder_03', 19.55, 0.93, 5.4, -H], ['Folder_Holder_04', 19.55, 0.93, 5.6, -H],
  ['FolderTray_03', 19.55, 0.93, 6.05, -H], ['Paper_Pile_03', 19.55, 1.43, 5.5, -H], ['Papers_03', 19.55, 1.43, 6.1, -H],
  ['Folder_PVC_02', 19.55, 1.93, 5.5, -H], ['Lunchbox_01', 19.55, 1.93, 6.1, -H],
  // coffee point
  ['CoffeeMachine_Small_01', 9.0, 0.75, 14.35, P], ['CoffeeMachine_Dripper_01', 9.85, 0.75, 14.4, P], ['CoffeeMachine_Dripper_01_Pot_01', 9.85, 0.75, 14.3, P],
  ['Cup_Lid_01', 10.25, 0.75, 14.45], ['Cup_Styrofoam_01', 10.3, 0.75, 14.1], ['Napkins_02', 10.15, 0.75, 13.95], ['Cup_Coffee_Disposable_Cap_01', 9.95, 0.75, 13.95],
  ['Snack_08', 8.45, 0.75, 14.45], ['Snack_14', 8.45, 0.75, 14.1, 0.4],
  // standing desk on a treadmill
  ['Desk_Treadmill_01', 6.4, 0, 14.1, P], ['LaptopStand_02', 6.4, 1.03, 14.25, P], ['Laptop_01', 6.4, 1.24, 14.2, P], ['Fan_USB_01', 6.95, 1.03, 14.35, P],
  // print station
  ['Chair_03', 13.4, 0, 12.3], ['Guillotine_01', 12.7, 0.75, 14.15, P], ['Guillotine_02', 13.5, 0.75, 14.35, P], ['Photocopier_02', 14.25, 0.75, 14.2, P],
  ['PaperTray_01_Empty_01', 14.4, 0.75, 13.5, P], ['HolePunch_01', 13.0, 0.75, 13.45], ['JellyStapler_01', 13.65, 0.75, 13.35], ['Paper_04', 12.35, 0.75, 13.3, 0.3],
  ['GraphicsTablet_03', 12.75, 0.75, 13.55, P], ['Pen_06', 13.3, 0.76, 13.25, 0.7, 1, H],
  // partitions between the little stations
  ['Divider_01', 11.4, 0, 12.35, H], ['Divider_Half_01', 7.7, 0, 13.6, H],
  ['CubicalWall_Tall_01', 4.9, 0, 12.85, H], ['CubicalWall_Pillar_Tall_01', 4.9, 0, 12.85], ['CubicalWall_Pillar_Tall_01', 4.9, 0, 14.85],
  ['CubicalWall_Tall_01_Half', 15.4, 0, 13.85, H],
  ['Rubbish_01', 17.3, 0, 12.2], ['Paper_Plane_01', 8.0, 0.08, 9.0, 0.7],
];

/** Interior columns at wall junctions. */
const PILLARS: Item[] = [
  ['B:Pillar_Interior_01', 2.5, 0, -2.5], ['B:Pillar_Interior_02', -10, 0, -2.5], ['B:Pillar_Interior_03', -10, 0, 5], ['B:Pillar_Interior_04', 2.5, 0, 10, P],
];

// ------------------------------------------------------------------ outside
const range = (a: number, b: number, step = PIECE) => Array.from({ length: Math.round((b - a) / step) }, (_, i) => a + i * step);
const OUTSIDE: Item[] = [
  // parapet caps on the outer walls, and on the low front wall
  ...range(-20, 30).map((x): Item => ['B:Roof_Side_01', x, 3.0, -14.93]),
  ...range(-20, 20).map((x): Item => ['B:Roof_Side_02', x, 3.0, 14.93]),
  ...range(-15, 15).map((z): Item => ['B:Roof_Side_02', -19.93, 3.0, z, -H]),
  ...range(-2.5, 15).map((z): Item => ['B:Roof_Side_01', 19.93, 3.0, z, -H]),
  // east wing
  ...range(-15, -2.5).map((z): Item => ['B:Roof_Side_01', 29.93, 3.0, z, -H]),
  ...range(20, 30).map((x): Item => ['B:Roof_Side_02', x, 3.0, -2.57]),
  ['B:Roof_Side_Corner_01', -20, 3.0, -15], ['B:Roof_Side_Corner_01', 30, 3.0, -15], ['B:Roof_Side_Corner_01', -20, 3.0, 15], ['B:Roof_Side_Corner_01', 20, 3.0, 15],
  ['B:Roof_Side_Corner_01', 30, 3.0, -2.5],
  ['B:Pillar_Exterior_01', -20.05, 0, -15.05], ['B:Pillar_Exterior_04', 30.05, 0, -15.05], ['B:Pillar_Exterior_03', -20.05, 0, 15.05, P], ['B:Pillar_Exterior_02', 20.05, 0, 15.05, P],
  ['B:Pillar_Exterior_02', 30.05, 0, -2.45, P],
  // downpipes
  ['Spouting_01', -20.3, 0, -14.4], ['Spouting_Top_01', -20.3, 0, -14.4], ['Spouting_02', 30.3, 0, -14.4], ['Spouting_Top_01', 30.3, 0, -14.4],
  ['Spouting_03', 20.3, 0, 7.2, P], ['Spouting_Top_01', 20.3, 0, 7.2], ['Spouting_01', -20.3, 0, 4.8], ['Spouting_Top_01', -20.3, 0, 4.8],
  // awnings over the windows (west side faces -x, east side faces +x)
  ['B:Window_Awning_01', -19.83, 2.45, -15, -H], ['B:Window_Awning_01', -19.83, 2.45, -10, -H],
  ['B:Window_Awning_Half_01', -19.83, 2.45, -2.5, -H], ['B:Window_Awning_Half_01', -19.83, 2.45, 2.5, -H], ['B:Window_Awning_Half_01', -19.83, 2.45, 5, -H],
  ['B:Window_Awning_Corner_01', -19.83, 2.45, -15, P], ['B:Window_Awning_Corner_02', -20, 2.45, 15, -H],
  ['B:Window_Awning_01', 29.83, 2.45, -7.5, H],
  ['B:Window_Awning_01', 19.83, 2.45, 2.5, H], ['B:Window_Awning_01', 19.83, 2.45, 10, H],
  ['B:Window_Cover_Glass_Gap_01', 19.83, 0, 15, H], ['B:Window_Cover_Pole_01', 19.83, 0, 15, H], ['B:Window_Cover_Pole_01', 19.83, 0, 12.5, H],
  ['B:Window_Cover_Glass_01', -19.83, 0, 12.5, -H], ['B:Window_Cover_Pole_01', -19.83, 0, 12.5, -H], ['B:Window_Cover_Pole_01', -19.83, 0, 15, -H],
  // main entrance: canopy on posts, a path to the street, plants either side
  ['B:WeatherCover_01', -15, 0, 16.35], ['B:Pillar_Metal_01', -17.3, 0, 17.55], ['B:Pillar_Metal_01', -12.7, 0, 17.55],
  ['B:Floor_Concrete_01', -16.25, -0.004, 15.0], ['Plant_12', -18.1, 0, 15.55], ['Plant_12', -11.9, 0, 15.55],
  ['BikeStand_01', -8.0, 0, 17.3, H], ['BikeStand_01', -7.2, 0, 17.3, H], ['BikeStand_01', -6.4, 0, 17.3, H],
  ['Benchseat_01', 3.0, 0, 17.9, P], ['Trashbin_01', 4.6, 0, 17.9], ['Rubbish_02', 4.95, 0, 17.45],
  ['Concrete_Cube_01', -18.9, 0, 16.4], ['Concrete_Cube_01', -11.0, 0, 16.4], ['Pole_01', -4, 0, 16.4], ['Pole_01', 6, 0, 16.4], ['Pole_01', 14, 0, 16.4],
  ['Sculpture_01', 10.5, 0, 20.5], ['Plant_07', -23.0, 0, 13.8],
  // west terrace: a wooden deck under a slatted pergola
  ...[-25, -22.5].flatMap((x) => [5, 7.5, 10].map((z): Item => ['B:Floor_Wood_01', x, 0.01, z])),
  ['B:Window_Awning_Slates_01', -19.99, 2.4, 7.5, -H], ['Table_Conference_02', -22.0, 0, 10.0, H],
  ['Table_Round_01', -22.6, 0, 6.3], ['Chair_04', -22.6, 0, 5.5], ['Chair_04', -23.4, 0, 6.3, H],
  ['Chair_04', -20.75, 0, 9.0, -H], ['Chair_04', -20.75, 0, 11.0, -H], ['Chair_04', -23.25, 0, 9.0, H], ['Chair_04', -23.25, 0, 11.0, H],
  // a shade net over the east yard
  ['B:Window_Net_01', 19.83, 2.6, 15, H], ['B:Window_Net_Pole_01', 19.83, 0, 14.9, H], ['B:Window_Net_Pole_01', 19.83, 0, 10.0, H],
  ['B:Window_Net_Half_01', 19.83, 2.6, 10, H], ['B:Window_Net_Corner_01', 19.83, 2.6, 7.5, H], ['B:Window_Net_Corner_Pole_01', 19.83, 0, 7.5, H],
  // aircon units on the east wall, and one for the Cyber Security wing
  ['Aircon_01', 20.02, 2.4, 6.0, H], ['Aircon_01', 20.02, 2.4, 13.0, H], ['Aircon_01', 30.02, 2.4, -13.6, H],
];

/** Raised garden beds on the lawn: edges, corners, grass and plants. */
function GardenBed({ x0, z0 }: { x0: number; z0: number }) {
  const list: Item[] = [
    ['B:GardenEdge_01', x0, 0.15, z0], ['B:GardenEdge_01', x0, 0.15, z0 + 2.5], ['B:GardenEdge_01', x0 + 2.5, 0.15, z0], ['B:GardenEdge_01', x0 + 2.5, 0.15, z0 + 2.5],
    ['B:GardenEdge_01', x0, 0.15, z0, H], ['B:GardenEdge_01', x0, 0.15, z0 + 5, H],
    ['B:GardenEdge_Corner_01', x0, 0.15, z0], ['B:GardenEdge_Corner_01', x0 + 2.5, 0.15, z0], ['B:GardenEdge_Corner_01', x0, 0.15, z0 + 5], ['B:GardenEdge_Corner_01', x0 + 2.5, 0.15, z0 + 5],
    ['B:Floor_Grass_01', x0, 0.04, z0], ['B:Floor_Grass_01', x0, 0.04, z0 + 2.5],
    ['Small_Hedge_01', x0 + 1.25, 0.05, z0 + 1.2, H], ['Plant_05', x0 + 1.25, 0.05, z0 + 3.0], ['Plant_04', x0 + 1.0, 0.05, z0 + 4.2],
  ];
  return <Items list={list} />;
}

/** Utility yard east of the building: ducts, pipes, gas bottles on a concrete pad. */
const YARD: Item[] = [
  ...[20.6, 23.1, 25.6].flatMap((x) => [7.5, 10, 12.5].map((z): Item => ['B:Floor_Concrete_01', x, -0.005, z])),
  // duct run 1 (02 series, along z)
  ['Ducting_02_Cap', 21.6, 0.4, 7.7, H], ['Ducting_02_Long', 21.6, 0.4, 7.7, H], ['Ducting_02_Vent_Side', 21.6, 0.4, 10.7, H], ['Ducting_02_Short', 21.6, 0.4, 11.7, H],
  ['Ducting_02_Vent_Small', 21.6, 0.4, 12.7, H], ['Ducting_02_Short_Half', 21.6, 0.4, 13.7, H], ['Ducting_02_Curve', 21.6, 0.4, 14.2, H],
  // duct run 2
  ['Ducting_02_T', 24.4, 0.4, 7.7, H], ['Ducting_02_Cross', 24.4, 0.4, 10.7, H], ['Ducting_02_RightAngle_Uncapped', 24.4, 0.4, 13.7, H],
  ['Ducting_02_Corner', 31.5, 0.4, 7.6], ['Ducting_02_RightAngle_Large', 31.5, 0.4, 11.4], ['Ducting_02_Vent_Large', 29.6, 0.4, 15.2, -H],
  ['Ducting_02_RightAngle_Capped', 27.5, 0.4, 15.2, P],
  // overhead 01 series along the wall
  ['Ducting_01_Short', 21.3, 2.6, 7.6, H], ['Ducting_01_Short_T_Vent', 21.3, 2.6, 8.6, H], ['Ducting_01_Tee', 21.3, 2.6, 9.6, H],
  ['Ducting_01_RightAngle', 21.3, 2.6, 12.6, H], ['Ducting_01_RightAngle_Vent', 21.3, 2.6, 13.64, H],
  ['Ducting_01_Cross', 25, 0.4, 18.0], ['Ducting_01_Curve', 26.9, 0.4, 18.0], ['Ducting_01_Curve_Cross', 30, 0.4, 18.0],
  ['Ducting_01_Curve_Tee', 25, 0.4, 20.0], ['Ducting_01_Curve_Tee_Reverse', 28.5, 0.4, 20.0],
  // pipes along the ground
  ['Pipe_01_Cap', 26.0, 0.19, 7.7, H], ['Pipe_01_Long', 26.0, 0.19, 7.7, H], ['Pipe_01_Short', 26.0, 0.19, 9.2, H], ['Pipe_01_Tee', 26.0, 0.19, 9.7, H],
  ['Pipe_01_Cross', 26.0, 0.19, 11.2, H], ['Pipe_01_Curve', 26.0, 0.19, 12.7, H], ['Pipe_01_RightAngle', 26.0, 0.19, 13.6, H],
  ['Propane_01', 27.4, 0, 7.9], ['Propane_01', 27.75, 0, 8.25], ['Propane_01', 27.35, 0, 8.45],
  ['Concrete_Cube_01', 20.9, 0, 15.3], ['Concrete_Cube_01', 27.6, 0, 15.3],
];

export function Fitout() {
  return (
    <group>
      <Items list={RESTROOMS} />
      <Items list={KITCHEN} />
      <Items list={MEETING} />
      <Items list={MANAGER} />
      <Items list={STUDIO} />
      <Items list={SERVER} />
      <Items list={GAME} />
      <Items list={LOUNGE} />
      <Items list={RECEPTION_ITEMS} />
      <Items list={SECURITY} />
      <Items list={CORRIDOR} />
      <Items list={WORKSPACE} />
      <Items list={PILLARS} />
      <Items list={OUTSIDE} />
      <Items list={YARD} />
      <GardenBed x0={-22.95} z0={-12.5} />
      <GardenBed x0={31.0} z0={-14.0} />
      <Ceiling />
    </group>
  );
}

// ------------------------------------------------------------------ ceiling (only seen from inside)
const CEILING_TILE: Record<string, string> = {
  meeting: 'B:Ceiling_02', manager: 'B:Ceiling_02', kitchen: 'B:Ceiling_01', reception: 'B:Ceiling_01', lounge: 'B:Ceiling_01',
  'wc-women': 'B:Ceiling_Panel_02', 'wc-men': 'B:Ceiling_Panel_02',
};
const CEILING: Item[] = ROOMS.flatMap((room) => {
  const out: Item[] = [];
  for (let x = room.minX; x < room.maxX - 0.01; x += PIECE) {
    for (let z = room.minZ; z < room.maxZ - 0.01; z += PIECE) {
      if (roomAt(x + PIECE / 2, z + PIECE / 2) !== room) continue;
      const tile = CEILING_TILE[room.id] ?? 'B:Ceiling_Panel_01';
      out.push([tile, x, 3.0, z]);
      if (room.id === 'security') continue; // lit by its screens, no ceiling lamps
      const cx = x + PIECE / 2, cz = z + PIECE / 2;
      const odd = Math.round((x + z) / PIECE) % 2 !== 0;
      if (tile.includes('Panel')) out.push([odd ? 'B:Ceiling_Panel_Light_02' : 'B:Ceiling_Panel_Light_01', cx, 2.99, cz]);
      else out.push([odd ? 'Light_06' : 'Light_07', cx, 2.97, cz]);
    }
  }
  return out;
});
const CEILING_EXTRAS: Item[] = [
  // pendants over tables
  ['Light_04', t.x - 1.2, 3.0, t.z], ['Light_04', t.x + 1.2, 3.0, t.z], ['Light_05', -6.25, 3.0, -11.3],
  ['Light_02', k.x - 0.7, 3.0, k.z], ['Light_02', k.x, 3.0, k.z], ['Light_02', k.x + 0.7, 3.0, k.z],
  ['Light_03', r.x - 0.8, 3.0, r.z], ['Light_03', r.x + 0.8, 3.0, r.z],
  ['Light_01', POOL_TABLES[0].x - 0.8, 3.0, POOL_TABLES[0].z], ['Light_01', POOL_TABLES[0].x + 0.8, 3.0, POOL_TABLES[0].z],
  ['Light_01', P1.x - 0.8, 3.0, P1.z], ['Light_01', P1.x + 0.8, 3.0, P1.z],
  ['Light_Fluorescent_01', 7.5, 3.0, -11.0], ['Light_Fluorescent_01', 7.5, 3.0, -8.0],
  // fans, air conditioning, projectors
  ['CeilingFan_01', -5, 3.0, 5], ['CeilingFan_01', -5, 3.0, 11], ['CeilingFan_02', 12.5, 3.0, -11.5],
  ['B:Ceiling_Aircon_01', 7.5, 3.0, 8.5], ['B:Ceiling_Aircon_01', 14, 3.0, 8.5], ['B:Ceiling_Aircon_01', -15, 3.0, -1.2],
  ['Projector_01_Ceiling', -17.6, 3.0, -10.3, -H], ['Projector_01_Ceiling', 1.5, 3.0, -10.5, H],
  ['CableTray_01_Cross', 12.5, 2.6, 3.9],
  // safety: detectors, sprinklers, cameras
  ...ROOMS.map((room): Item => ['Fire_Detector_01', (room.minX + room.maxX) / 2 + 0.6, 2.99, (room.minZ + room.maxZ) / 2 + 0.6, 0, 1, H]),
  ...[-15, -5, 5, 15, 25].map((x): Item => ['Sprinkler', x, 3.0, -3.75]),
  // cable trays over the security consoles, an air conditioner by the door
  ['CableTray_01_Long', 28.5, 2.7, -11.2], ['CableTray_01_Long', 28.5, 2.7, -8.3], ['B:Ceiling_Aircon_01', 25, 3.0, -6.4],
  ...[6, 11, 16].flatMap((x) => [4, 9].map((z): Item => ['Sprinkler', x, 3.0, z])),
  ['Security_Camera_02', -10, 3.0, -3.75], ['Security_Camera_02', 10, 3.0, -3.75], ['Security_Camera_02', -11, 3.0, 14.4], ['Security_Camera_02', 9.5, 3.0, -14.4], ['Security_Camera_02', 29.4, 3.0, -5.6],
];

/** The ceiling only shows once the camera is inside the building (Walk-in mode). */
function Ceiling() {
  const mode = useOffice((s) => s.mode);
  const shot = useOffice((s) => s.shot);
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }) => { if (group.current) group.current.visible = camera.position.y < 2.95; });
  if (!insideView(mode, shot)) return null;
  return (
    <group ref={group} visible={false}>
      <Items list={CEILING} />
      <Items list={CEILING_EXTRAS} />
    </group>
  );
}
