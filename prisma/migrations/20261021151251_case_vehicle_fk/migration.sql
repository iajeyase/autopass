-- AddForeignKey
ALTER TABLE "RegistrationCase" ADD CONSTRAINT "RegistrationCase_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
