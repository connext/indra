#!/user/bin/env bash

function cleanup {
  docker ps --filter name=indra_v2_payment_bot* -aq | xargs docker container stop
}
trap cleanup EXIT SIGINT

mnemonics=(
  "hill session album sentence ecology brief sleep delay act cage appear mistake" 
  "humble sense shrug young vehicle assault destroy cook property average silent travel" 
  "roof traffic soul urge tenant credit protect conduct enable animal cinnamon adult" 
  "flee scout proud unfold confirm occur girl three enemy filter puppy keep" 
  "rail fever primary bread mirror radar insect angle man arena tone extra" 
  "attend must slice abuse hair top riot squeeze frozen april delay common" 
  "fury month village tumble bean property correct elephant year knife clock cinnamon" 
  "second crane day reopen quit few loan room stuff spin orchard frost" 
)

bash ops/payment-bot.sh -i 1 -q -a $tokenAddress

END=1
echo;echo "Requesting token collateral for recipient bot";echo;sleep 1
for i in $(seq 1 $END);
do 
  bash ops/payment-bot.sh -i ${i} -a $tokenAddress -m "${mnemonics[i]}" &
  sleep 5
done

sleep 1;echo;echo "Depositing tokens into sender bot";echo;sleep 1
for i in $(seq 1 $END);
do 
  bash ops/payment-bot.sh -i 2 -d 0.1 -a $tokenAddress -m "${mnemonics[i]}" &
  sleep 1
done

sleep 1;echo;echo "Sending tokens to recipient bot";echo;sleep 1
for i in $(seq 1 $END);
do 
  bash ops/payment-bot.sh -i 2 -t 0.05 -c $id -a $tokenAddress -m "${mnemonics[i]}" &
  sleep 1
done