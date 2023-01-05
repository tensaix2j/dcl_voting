
import * as ui from '@dcl/ui-scene-utils'
import { getUserData, UserData } from '@decentraland/Identity'
import { Utils } from "src/utils"


export class Voting extends Entity implements ISystem {

    public candidates = [];
    public voted = -1;
    public userData;
    public tick = 0;
    public messageBus;
    
    constructor(x,y,z) {
        
        super();
        this.addComponent( new Transform({
            position: new Vector3(x,y,z)
        }));
        
        let podium_coord_x = [ -4, 4,-4 , 4 ];
        let podium_coord_z = [  4, 4,-4, -4 ];
        let podium_shape = new GLTFShape("models/podium.glb");
            
            
        for ( let i = 0 ; i < 4 ; i++) {
            
            let podium = new Entity();
            podium.setParent(this);
            podium.addComponent( new Transform({
                position: new Vector3( podium_coord_x[i], 0 , podium_coord_z[i])
            }))
            podium.addComponent( podium_shape );
            this.candidates.push( podium );

            let podium_display = new Entity();
            podium_display.setParent( podium );
            podium_display.addComponent( new Transform({
                position: new Vector3( 0, 0.5, -0.26),
                scale: new Vector3(0.2, 0.2, 0.2)
            }))
            podium_display.addComponent( new TextShape("0"));
            podium["display"] = podium_display;
            podium["vote_id"] = i;

            let onpointerdown = new OnPointerDown(
                (e)=>{
                    this.button_pressed(e);
                },{
                    hoverText: "Vote 投票",
                    distance:20
                }
            )
            podium["click"] = onpointerdown;
            podium.addComponent( onpointerdown );
        }

        let messageBus = new MessageBus();
        let _this = this;
        messageBus.on("vote", (arg) => {
			log("OnMessageBus", "vote");
            _this.get_result();            
		});


        this.messageBus = messageBus;
        this.get_result();

        engine.addEntity(this);
        engine.addSystem(this);
    }

    //---------------
    async setUserData() {
        const data = await getUserData()
        this.userData = data
    }


    //----------------------
    async cast_vote( item_id ) {
        
        let url = "https://tensaistudio.xyz/dragoncity/cast_vote.rvt";
       	
       	if (!this.userData) {
   			await this.setUserData()
  		}	

        let sig      = Utils.sha256(this.userData.userId + "dragoncity" + item_id );
        let body = JSON.stringify({
			useraddr : this.userData.userId,
            username : this.userData.displayName,
            item_id  : item_id,
            sig      : sig
		})

        let fetchopt = {
            headers: {
              'content-type': 'application/json'
            },
            body: body,
            method: 'POST'
        };
        let _this = this;
        
        try {
            
            let resp = await fetch(url, fetchopt ).then(response => response.json())
            if( resp["success"] == 1 ) {
                
                log("JDEBUG", "cast_vote", "Sent request to URL", url , "SUCCESS", resp );
                this.voted = 1;
                this.messageBus.emit( "vote", {} );


            } else if ( resp["success"] == 2 ) {

                this.voted = 1;
                this.already_voted();

            }



        } catch(err) {
            log("error to do", url, fetchopt, err );
        }
    }


    //----------------------
    // This function is called in 3 occasions:
    // 1. Scene loaded.
    // 2. Every minute 
    // 3. Notification of somebody voted via msg bus.
    // 4. After voting. (via 3 due to msg is also received by self)

    // Query to server to get the result of current poll.
    async get_result( ) {
        
        let url = "https://tensaistudio.xyz/dragoncity/get_result.tcl";
       	
       	if (!this.userData) {
   			await this.setUserData()
  		}	


        let fetchopt = {
            headers: {
              'content-type': 'application/json'
            },
            method: 'GET'
        };
        let _this = this;
        
        try {
            
            let resp = await fetch(url, fetchopt ).then(response => response.json())
            for ( let i = 0 ; i < resp.length ; i++) {
                let vote_id = parseInt(resp[i]["vote_id"]);
                let count   = parseInt(resp[i]["count"]);

                _this.candidates[vote_id]["display"].getComponent(TextShape).value = count ;

            }


        } catch(err) {
            log("error to do", url, fetchopt, err );
        }
    }


    //--------
    button_pressed(e) {

        if ( this.voted == -1 ) {
            
            let ent = engine.entities[e.hit.entityId];
            let vote_id = ent["vote_id"];
            this.cast_vote( vote_id );

            

        } else {
            this.already_voted();
            
        }
    }

    //---------------
    already_voted(){
        ui.displayAnnouncement("You have already voted. 您已经投过票了。" ,10, Color4.Yellow(), 14, false);
    }


    //----------------
    update(dt) {

        let update_every_n_minute = 1;
        this.tick += 1;

        if ( this.tick > 1800 * update_every_n_minute ) {
            
            log("Refresh board and highscore");
            this.get_result();
            this.tick = 0;
        }
    }

}